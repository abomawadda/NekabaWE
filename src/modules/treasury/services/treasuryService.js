/**
 * خدمة الخزينة — Treasury Service
 *
 * تتضمن:
 * - حفظ / تحديث السندات في Firestore
 * - حذف السندات
 * - رفع المرفقات إلى Firebase Storage مع البيان
 * - حذف المرفقات من Storage
 * - فحص تكرار رقم الشيك
 *
 * تخزين المرفقات:
 * ┌─────────────────────────────────────────────────────┐
 * │  Firebase Storage path:                             │
 * │  treasury/attachments/{txId}/{timestamp}_{filename} │
 * │                                                     │
 * │  Firestore (داخل مستند السند):                      │
 * │  attachments: [{ id, name, description, url,        │
 * │                  storagePath, size, mimeType,        │
 * │                  uploadedAt }]                      │
 * └─────────────────────────────────────────────────────┘
 *
 * الأمان:
 * - Firebase Storage Security Rules تمنع الوصول إلا للمستخدمين المصادق عليهم
 * - كل ملف مرتبط بـ txId لا يمكن تخمينه
 * - روابط التحميل (Download URLs) مؤقتة بشكل افتراضي ومحمية بـ Firebase Auth
 */

import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { useFirebase } from "../../../app/providers/FirebaseProvider";
import {
  buildLegacyIssuedCheckId,
  isDirectFinanceType,
  isLegacyCheckType,
  getDefaultRequiresSettlement,
  getPendingLegacyCheckTransactions,
  getSettlementMode,
  getIssuedCheckDisplayParty,
  normalizeIssuedCheckType,
} from "../helpers/issuedChecks";

const LEGACY_COLLECTION = "transactions";
const BATCH_SIZE = 400;
const ISSUED_CHECKS_COLLECTION = "issued_checks";

function normalizeIssuedCheckPayload(tx = {}, options = {}) {
  const type = normalizeIssuedCheckType(tx.type);
  const requiresSettlement = Boolean(
    tx.requires_settlement ??
      tx.requiresSettlement ??
      getDefaultRequiresSettlement(type)
  );

  return {
    ...tx,
    ...options,
    type,
    requires_settlement: requiresSettlement,
    requiresSettlement,
    settlement_mode:
      tx.settlement_mode ||
      tx.settlementMode ||
      getSettlementMode(type, requiresSettlement),
    party: tx.party || getIssuedCheckDisplayParty(tx) || "",
    attachments: Array.isArray(tx.attachments) ? tx.attachments : [],
  };
}

export function useTreasuryService() {
  const { app } = useFirebase();
  const db = getFirestore(app);
  const storage = getStorage(app);

  const STORAGE_ROOT = "treasury/attachments";

  const getTargetCollection = (tx = {}) => {
    if (tx?.sourceCollection) return tx.sourceCollection;
    if (isDirectFinanceType(tx.type)) return LEGACY_COLLECTION;
    if (isLegacyCheckType(tx.type) && !tx?.legacySourceId) return LEGACY_COLLECTION;
    return ISSUED_CHECKS_COLLECTION;
  };

  // ──────────────────────────────────────────────────────────
  // حفظ / تحديث سند
  // ──────────────────────────────────────────────────────────
  /**
   * يستخدم setDoc مع ID ثابت:
   * - إذا كان tx.id موجودًا → تحديث (overwrite) للمستند الحالي بالكامل
   * - إذا لم يكن موجودًا → إنشاء مستند جديد بـ ID مُنشأ تلقائيًا
   */
  async function saveTransaction(tx) {
    const targetCollection = getTargetCollection(tx);
    const txId = tx.id || doc(collection(db, targetCollection)).id;
    const finalData = normalizeIssuedCheckPayload(tx, {
      id: txId,
      checkNum: isDirectFinanceType(tx.type) ? "" : tx.checkNum,
      requires_settlement: isDirectFinanceType(tx.type)
        ? false
        : Boolean(tx.requires_settlement ?? tx.requiresSettlement),
      requiresSettlement: isDirectFinanceType(tx.type)
        ? false
        : Boolean(tx.requires_settlement ?? tx.requiresSettlement),
      settlement_mode: isDirectFinanceType(tx.type)
        ? "none"
        : tx.settlement_mode ||
          (Boolean(tx.requires_settlement ?? tx.requiresSettlement)
            ? "check_only"
            : "none"),
      updatedAt: new Date().toISOString(),
      createdAt: tx.createdAt || new Date().toISOString(),
    });

    await setDoc(doc(db, targetCollection, txId), finalData);
    return txId;
  }

  async function migrateLegacyChecksToIssuedChecks({
    legacyTransactions = [],
    issuedChecks = [],
  } = {}) {
    const pendingTransactions = getPendingLegacyCheckTransactions(
      legacyTransactions,
      issuedChecks
    );

    if (!pendingTransactions.length) {
      return { migratedCount: 0, batches: 0 };
    }

    const now = new Date().toISOString();
    let migratedCount = 0;
    let batches = 0;

    for (let index = 0; index < pendingTransactions.length; index += BATCH_SIZE) {
      const slice = pendingTransactions.slice(index, index + BATCH_SIZE);
      const batch = writeBatch(db);

      slice.forEach((tx) => {
        const migratedId = buildLegacyIssuedCheckId(tx.id);
        const normalized = normalizeIssuedCheckPayload(tx, {
          id: migratedId,
          legacySourceId: tx.id,
          sourceTransactionId: tx.id,
          legacySourceCollection: LEGACY_COLLECTION,
          migratedFromLegacy: true,
          migratedAt: now,
          originalLegacyType: tx.type,
          createdAt: tx.createdAt || now,
          updatedAt: now,
          state: tx.state || "posted",
        });

        batch.set(doc(db, ISSUED_CHECKS_COLLECTION, migratedId), normalized, { merge: true });
        migratedCount += 1;
      });

      await batch.commit();
      batches += 1;
    }

    return { migratedCount, batches };
  }

  // ──────────────────────────────────────────────────────────
  // حذف سند (مع مرفقاته من Storage)
  // ──────────────────────────────────────────────────────────
  async function deleteTransaction(tx) {
    // حذف المرفقات أولًا من Storage
    if (tx?.attachments?.length) {
      await Promise.allSettled(
        tx.attachments.map((att) => deleteAttachment(att.storagePath))
      );
    }
    await deleteDoc(doc(db, getTargetCollection(tx), tx.id));
  }

  // ──────────────────────────────────────────────────────────
  // فحص تكرار رقم الشيك
  // ──────────────────────────────────────────────────────────
  async function isChequeDuplicate(chequeNum, currentId = null) {
    if (!chequeNum) return false;

    const q = query(
      collection(db, ISSUED_CHECKS_COLLECTION),
      where("checkNum", "==", String(chequeNum))
    );
    const snap = await getDocs(q);

    // مكرر فقط إذا وُجد مستند آخر غير الحالي
    return snap.docs.some((d) => d.id !== currentId);
  }

  // ──────────────────────────────────────────────────────────
  // رفع مرفق مع بيانه إلى Firebase Storage
  // ──────────────────────────────────────────────────────────
  /**
   * @param {File} file - الملف المراد رفعه
   * @param {string} txId - معرّف السند (مطلوب لتنظيم المسار)
   * @param {string} description - بيان المرفق (مثال: "صورة الشيك")
   * @param {function} onProgress - دالة اختيارية للتقدم (0–100)
   * @returns {object} بيانات المرفق للحفظ في Firestore
   */
  async function uploadAttachment(
    file,
    txId,
    description = "",
    onProgress = null
  ) {
    if (!txId) throw new Error("txId مطلوب لرفع المرفق");

    const timestamp = Date.now();
    // تعقيم اسم الملف للمسار
    const safeName = file.name.replace(/[^\w.\u0600-\u06FF-]/g, "_");
    const storagePath = `${STORAGE_ROOT}/${txId}/${timestamp}_${safeName}`;

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          onProgress?.(progress);
        },
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            id: `att_${timestamp}`,
            name: file.name,
            description: description.trim(),
            url: downloadURL,
            storagePath,
            size: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString(),
          });
        }
      );
    });
  }

  // ──────────────────────────────────────────────────────────
  // حذف مرفق من Firebase Storage
  // ──────────────────────────────────────────────────────────
  async function deleteAttachment(storagePath) {
    if (!storagePath) return;
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      // لا نوقف العملية إذا كان الملف غير موجود بالفعل
      if (err.code !== "storage/object-not-found") {
        console.warn("فشل حذف المرفق من Storage:", err);
      }
    }
  }

  return {
    saveTransaction,
    migrateLegacyChecksToIssuedChecks,
    deleteTransaction,
    isChequeDuplicate,
    uploadAttachment,
    deleteAttachment,
  };
}

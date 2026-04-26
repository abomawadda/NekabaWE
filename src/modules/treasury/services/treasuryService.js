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
  getPendingLegacyCheckTransactions,
  isDirectFinanceType,
  getDefaultRequiresSettlement,
  getSettlementMode,
  getIssuedCheckDisplayParty,
  normalizeIssuedCheckType,
  LEGACY_ISSUED_CHECK_PREFIX,
} from "../helpers/issuedChecks";

const LEGACY_COLLECTION = "transactions";
const BATCH_SIZE = 400;
const ISSUED_CHECKS_COLLECTION = "issued_checks";

const normalizeCollectionName = (value = "") => {
  const name = String(value || "").trim();
  if (name === ISSUED_CHECKS_COLLECTION) return ISSUED_CHECKS_COLLECTION;
  if (name === LEGACY_COLLECTION) return LEGACY_COLLECTION;
  return "";
};

const isMigratedLegacyIssuedCheck = (tx = {}) => {
  const id = String(tx?.id || "");
  return Boolean(
    tx?.migratedFromLegacy ||
      tx?.legacySourceId ||
      tx?.sourceTransactionId ||
      id.startsWith(LEGACY_ISSUED_CHECK_PREFIX)
  );
};

const shouldKeepInLegacyTransactions = (tx = {}) => {
  const sourceCollection = normalizeCollectionName(tx?.sourceCollection);

  // الخصومات المباشرة ليست شيكات وتظل في transactions.
  if (isDirectFinanceType(tx?.type)) return true;

  // السجلات القديمة التي تظهر من transactions قبل ترحيلها يجب تحديثها/حذفها من نفس مكانها.
  if (sourceCollection === LEGACY_COLLECTION && !isMigratedLegacyIssuedCheck(tx)) {
    return true;
  }

  return false;
};

function normalizeIssuedCheckPayload(tx = {}, options = {}) {
  const type = normalizeIssuedCheckType(tx.type);
  const explicitRequiresSettlement =
    tx.requires_settlement ?? tx.requiresSettlement ?? options.requires_settlement;
  const requiresSettlement = isDirectFinanceType(type)
    ? false
    : explicitRequiresSettlement === undefined || explicitRequiresSettlement === null
      ? getDefaultRequiresSettlement(type)
      : Boolean(explicitRequiresSettlement);

  return {
    ...tx,
    ...options,
    type,
    requires_settlement: requiresSettlement,
    requiresSettlement,
    settlement_mode:
      tx.settlement_mode ||
      tx.settlementMode ||
      options.settlement_mode ||
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
    const sourceCollection = normalizeCollectionName(tx?.sourceCollection);

    if (sourceCollection === ISSUED_CHECKS_COLLECTION) return ISSUED_CHECKS_COLLECTION;
    if (shouldKeepInLegacyTransactions(tx)) return LEGACY_COLLECTION;

    // القاعدة الصحيحة: أي شيك جديد أو شيك مُرحّل يجب أن يكون في issued_checks.
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
    const normalizedType = normalizeIssuedCheckType(tx.type);
    const requiresSettlement = isDirectFinanceType(normalizedType)
      ? false
      : tx.requires_settlement === undefined && tx.requiresSettlement === undefined
        ? getDefaultRequiresSettlement(normalizedType)
        : Boolean(tx.requires_settlement ?? tx.requiresSettlement);

    const finalData = normalizeIssuedCheckPayload(tx, {
      id: txId,
      sourceCollection: targetCollection,
      checkNum: isDirectFinanceType(normalizedType) ? "" : tx.checkNum,
      requires_settlement: requiresSettlement,
      requiresSettlement,
      settlement_mode: isDirectFinanceType(normalizedType)
        ? "none"
        : tx.settlement_mode || getSettlementMode(normalizedType, requiresSettlement),
      isSettled: requiresSettlement ? Boolean(tx.isSettled) : false,
      settlementExpenses: Array.isArray(tx.settlementExpenses)
        ? tx.settlementExpenses
        : [],
      updatedAt: new Date().toISOString(),
      createdAt: tx.createdAt || new Date().toISOString(),
    });

    await setDoc(doc(db, targetCollection, txId), finalData, { merge: false });
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
          sourceCollection: ISSUED_CHECKS_COLLECTION,
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

  const getDeleteDocumentRefs = (tx = {}) => {
    const refs = new Map();
    const id = String(tx?.id || "").trim();
    if (!id) return [];

    const addRef = (collectionName, docId) => {
      if (!collectionName || !docId) return;
      refs.set(`${collectionName}/${docId}`, doc(db, collectionName, docId));
    };

    const targetCollection = getTargetCollection(tx);
    addRef(targetCollection, id);

    if (isDirectFinanceType(tx?.type)) {
      addRef(LEGACY_COLLECTION, id);
      return Array.from(refs.values());
    }

    // حماية إضافية: عند حذف شيك نحذف أي نسخة مطابقة في السجل الموحد أو السجل القديم.
    addRef(ISSUED_CHECKS_COLLECTION, id);
    addRef(LEGACY_COLLECTION, id);

    const sourceId = String(tx?.legacySourceId || tx?.sourceTransactionId || "").trim();
    if (sourceId) {
      addRef(LEGACY_COLLECTION, sourceId);
      addRef(ISSUED_CHECKS_COLLECTION, buildLegacyIssuedCheckId(sourceId));
    }

    if (id.startsWith(LEGACY_ISSUED_CHECK_PREFIX)) {
      const legacyId = id.slice(LEGACY_ISSUED_CHECK_PREFIX.length);
      addRef(LEGACY_COLLECTION, legacyId);
    }

    return Array.from(refs.values());
  };

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

    const refs = getDeleteDocumentRefs(tx);
    if (!refs.length) return;

    const batch = writeBatch(db);
    refs.forEach((refDoc) => batch.delete(refDoc));
    await batch.commit();
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

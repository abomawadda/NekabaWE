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

export function useTreasuryService() {
  const { app } = useFirebase();
  const db = getFirestore(app);
  const storage = getStorage(app);

  const COLLECTION = "transactions";
  const STORAGE_ROOT = "treasury/attachments";

  // ──────────────────────────────────────────────────────────
  // حفظ / تحديث سند
  // ──────────────────────────────────────────────────────────
  /**
   * يستخدم setDoc مع ID ثابت:
   * - إذا كان tx.id موجودًا → تحديث (overwrite) للمستند الحالي بالكامل
   * - إذا لم يكن موجودًا → إنشاء مستند جديد بـ ID مُنشأ تلقائيًا
   */
  async function saveTransaction(tx) {
    const txId = tx.id || doc(collection(db, COLLECTION)).id;

    const finalData = {
      ...tx,
      id: txId,
      attachments: tx.attachments || [],
      updatedAt: new Date().toISOString(),
      createdAt: tx.createdAt || new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION, txId), finalData);
    return txId;
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
    await deleteDoc(doc(db, COLLECTION, tx.id));
  }

  // ──────────────────────────────────────────────────────────
  // فحص تكرار رقم الشيك
  // ──────────────────────────────────────────────────────────
  async function isChequeDuplicate(chequeNum, currentId = null) {
    if (!chequeNum) return false;

    const q = query(
      collection(db, COLLECTION),
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
    deleteTransaction,
    isChequeDuplicate,
    uploadAttachment,
    deleteAttachment,
  };
}

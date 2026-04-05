/**
 * التحقق من صحة بيانات حركة الخزينة
 * 
 * الأخطاء المُصلحة:
 * - إزالة التحقق من حقل employee (لم يعد كيانًا منفصلًا - أصبح نصًا في party)
 * - إضافة التحقق من حقل party لجميع أنواع السندات
 * - تحسين التحقق من المبلغ
 */
export function validateTransaction(tx) {
  const errors = {};

  // ── التاريخ ──────────────────────────────────────────
  if (!tx.date) errors.date = "تاريخ الحركة مطلوب";

  // ── المبلغ ────────────────────────────────────────────
  if (!tx.amount || Number(tx.amount) <= 0)
    errors.amount = "المبلغ يجب أن يكون رقمًا موجبًا";

  // ── رقم الشيك (للحركات المدينة فقط) ─────────────────
  if (tx.type !== "deposit" && !tx.checkNum)
    errors.checkNum = "رقم الشيك مطلوب للحركات المدينة";

  // ── الجهة / اسم العضو ─────────────────────────────────
  if (!tx.party || String(tx.party).trim() === "")
    errors.party =
      tx.type === "aid"
        ? "اسم العضو مطلوب"
        : tx.type === "deposit"
        ? "جهة الإيداع مطلوبة"
        : "اسم المستلم مطلوب";

  // ── تفاصيل خاصة بسند الإعانة ──────────────────────────
  if (tx.type === "aid") {
    if (!tx.aidCategory) errors.aidCategory = "تصنيف الإعانة مطلوب";

    if (tx.incidentDate && tx.incidentDate > tx.date)
      errors.incidentDate =
        "تاريخ الواقعة لا يمكن أن يتجاوز تاريخ الحركة";
  }

  return errors;
}

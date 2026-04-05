export function validateEmployee(emp, existingList = []) {
  const errors = {};

  // required
  if (!emp.jobId?.trim()) errors.jobId = "الرقم الوظيفي مطلوب";
  if (!emp.name?.trim()) errors.name = "الاسم الرباعي مطلوب";

  // unique constraints
  if (emp.phone) {
    const exists = existingList.some(
      (e) => e.phone === emp.phone && e.jobId !== emp.jobId
    );
    if (exists) errors.phone = "رقم الهاتف مسجل بالفعل";
  }

  if (emp.email) {
    const exists = existingList.some(
      (e) => e.email === emp.email && e.jobId !== emp.jobId
    );
    if (exists) errors.email = "البريد الإلكتروني مسجل بالفعل";
  }

  if (emp.nationalId) {
    if (!/^\d{14}$/.test(emp.nationalId))
      errors.nationalId = "الرقم القومي يجب أن يكون 14 رقمًا";

    const exists = existingList.some(
      (e) => e.nationalId === emp.nationalId && e.jobId !== emp.jobId
    );
    if (exists) errors.nationalId = "الرقم القومي مسجل بالفعل";
  }

  return errors;
}
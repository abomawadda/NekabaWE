import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, getDocs, query, where, orderBy, limit as fbLimit, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import {
  User, Hash, Phone, Fingerprint, ShieldCheck, Building,
  CalendarDays, Star, CreditCard, Wallet, Printer, FileEdit,
  LogOut, AlertCircle, CheckCircle2, X, Loader2, Briefcase,
  ChevronRight, FileText, Award, Heart, UserCheck, ScanLine,
  MapPin, Mail, Settings, BadgeCheck, Clock, Info,
} from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { printMembershipCertificate } from "./helpers/portalPrint";
import { logAuditEvent } from "../../utils/auditLog";
import { formatEmployeeDate, getEmployeeBirthDate } from "../../utils/memberBenefits";

const PORTAL_STORAGE_KEY = "nekaba_member_portal_session";

function InfoIcon({ icon: Icon, label, value, color = "teal" }) {
  const colors = {
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    slate: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
      <div className={clsx("p-2 rounded-lg shrink-0", colors[color] || colors.teal)}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={value}>{value || "—"}</p>
      </div>
    </div>
  );
}

function UpdateRequestModal({ employee, onClose, onSuccess }) {
  const T = useT();
  const [form, setForm] = useState({
    phone: employee.phone || "",
    email: employee.email || "",
    address: employee.address || "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDoc(collection(db, "update_requests"), {
        employeeId: employee.id,
        jobId: employee.jobId,
        name: employee.name,
        nationalId: employee.nationalId,
        requestedChanges: form,
        status: "pending",
        createdAt: serverTimestamp(),
        createdAtIso: new Date().toISOString(),
      });
      await logAuditEvent("portal.update_request", {
        targetId: employee.id,
        jobId: employee.jobId,
        riskLevel: "low",
        page: "/member-portal",
      });
      onSuccess();
    } catch (err) {
      alert("حدث خطأ أثناء إرسال الطلب: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={clsx("w-full max-w-lg rounded-2xl border shadow-2xl p-6", T.card)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black flex items-center gap-2">
            <FileEdit size={18} className="text-teal-600" />
            طلب تحديث البيانات
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">رقم الموبايل</span>
            <input type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">البريد الإلكتروني</span>
            <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">العنوان</span>
            <input type="text" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">ملاحظات (اختياري)</span>
            <textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl bg-teal-600 text-white text-sm font-black hover:bg-teal-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "جارٍ الإرسال..." : "إرسال طلب التحديث"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MemberPortal() {
  const T = useT();
  const [step, setStep] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employee, setEmployee] = useState(null);
  const [aidChecks, setAidChecks] = useState([]);
  const [showUpdate, setShowUpdate] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const formRef = useRef({ jobId: "", nationalId: "" });

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PORTAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.employee && parsed?.timestamp && Date.now() - parsed.timestamp < 86400000) {
          setEmployee(parsed.employee);
          setStep("dashboard");
        } else {
          localStorage.removeItem(PORTAL_STORAGE_KEY);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (employee && step === "dashboard") {
      localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify({
        employee,
        timestamp: Date.now(),
      }));
      fetchAidChecks(employee);
    }
  }, [employee, step]);

  const fetchAidChecks = async (emp) => {
    try {
      const snap = await getDocs(query(
        collection(db, "issued_checks"),
        where("type", "==", "aid"),
        orderBy("createdAtIso", "desc"),
        fbLimit(50)
      ));
      const empName = emp.name?.trim();
      const checks = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => {
          const party = (c.party || c.beneficiaryName || "").trim();
          return party.includes(empName) || party.includes(emp.jobId || "");
        });
      setAidChecks(checks);
    } catch {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const jobId = formRef.current.jobId.value.trim();
      const nationalId = formRef.current.nationalId.value.trim();

      if (!jobId || !nationalId) {
        setError("برجاء إدخال الرقم الوظيفي والرقم القومي.");
        setLoading(false);
        return;
      }

      const normalizedJobId = jobId.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");
      const normalizedNid = nationalId.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");

      if (normalizedNid.length !== 14) {
        setError("الرقم القومي يجب أن يكون 14 رقمًا.");
        setLoading(false);
        return;
      }

      const snap = await getDocs(query(collection(db, "employees")));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const match = all.find((emp) => {
        const empJobId = String(emp.jobId || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");
        const empNid = String(emp.nationalId || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");
        return empJobId === normalizedJobId && empNid === normalizedNid;
      });

      if (!match) {
        await logAuditEvent("portal.login_failed", {
          jobId: normalizedJobId,
          riskLevel: "low",
          page: "/member-portal",
        });
        setError("لم نتمكن من مطابقة بياناتك. تأكد من الرقم الوظيفي والرقم القومي.");
        setLoading(false);
        return;
      }

      await logAuditEvent("portal.login_success", {
        targetId: match.id,
        jobId: match.jobId,
        riskLevel: "low",
        page: "/member-portal",
      });

      setEmployee(match);
      setStep("dashboard");
      showToast("مرحبًا بك في بوابة العضو!");
    } catch (err) {
      setError("حدث خطأ في الاتصال. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setEmployee(null);
    setAidChecks([]);
    setStep("login");
    localStorage.removeItem(PORTAL_STORAGE_KEY);
  };

  const calcAge = (birthDateStr) => {
    if (!birthDateStr) return null;
    const parts = birthDateStr.split("/");
    let d, m, y;
    if (parts.length === 3) {
      if (parts[2].length === 4) { y = +parts[2]; m = +parts[1] - 1; d = +parts[0]; }
      else { y = +parts[0]; m = +parts[1] - 1; d = +parts[2]; }
    }
    if (!y) return null;
    const birth = new Date(y, m, d);
    if (isNaN(birth)) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  if (step === "login") {
    return (
      <div className="min-h-screen bg-[linear-gradient(150deg,#f8fafc,#ecfeff,#f8fafc)] dark:bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-5 sm:p-7">
            <div className="flex items-center justify-between mb-6">
              <img src="/brand-left.png" alt="الهوية" className="w-14 h-14 object-contain" />
              <div className="w-11 h-11 rounded-2xl bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                <UserCheck size={22} />
              </div>
            </div>

            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">بوابة العضو</h1>
            <p className="text-[11px] font-bold text-slate-500 mb-6">أدخل بياناتك للاطلاع على ملفك النقابي وطباعة الشهادات</p>

            <form className="space-y-4" onSubmit={handleLogin}>
              <label className="block space-y-2">
                <span className="text-[11px] font-black text-slate-500">الرقم الوظيفي</span>
                <div className="relative">
                  <Hash size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input ref={(el) => { formRef.current.jobId = el; }}
                    className="w-full pr-10 pl-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    placeholder="مثال: 12345" autoComplete="off" />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-black text-slate-500">الرقم القومي</span>
                <div className="relative">
                  <CreditCard size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input ref={(el) => { formRef.current.nationalId = el; }} type="tel" maxLength={14}
                    className="w-full pr-10 pl-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    placeholder="14 رقمًا" autoComplete="off" />
                </div>
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 px-4 py-3 text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-teal-600 text-white text-sm font-black hover:bg-slate-800 dark:hover:bg-teal-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "جارٍ التحقق..." : "دخول"}
              </button>
            </form>

            <div className="mt-5 text-center text-[10px] font-bold text-slate-400">
              هذه البوابة مخصصة لأعضاء النقابة للاطلاع على بياناتهم
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  const bd = formatEmployeeDate(getEmployeeBirthDate(employee)) || employee.birthDate || employee.dateOfBirth;
  const age = calcAge(bd);
  const isBoard = ["رئيس المجلس", "الأمين العام", "أمين الصندوق", "نائب الرئيس", "عضو مجلس إدارة", "عضو مجلس"].includes(employee.membershipStatus?.trim());

  const statusColor = (() => {
    const s = (employee.memberState || employee.status || "").trim();
    if (["نشط", "مسدد"].includes(s)) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (["موقوف", "متأخر", "إجازة بدون أجر"].some((x) => s.includes(x))) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    if (["معاش", "وفاة", "استقالة"].some((x) => s.includes(x))) return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  })();

  return (
    <div className={clsx("min-h-screen", T.page)} dir="rtl">
      {toast && (
        <div className={clsx("fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 animate-in fade-in slide-in-from-top-4",
          toast.type === "success"
            ? "bg-emerald-600 text-white"
            : "bg-rose-600 text-white"
        )}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        <div className={clsx("rounded-2xl border p-5 md:p-6 flex flex-col md:flex-row gap-5 items-center md:items-start", T.card)}>
          <div className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-800 bg-gradient-to-br from-teal-500 to-sky-600 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
            {employee.photo ? <img src={employee.photo} className="w-full h-full object-cover rounded-xl" alt="" /> : employee.name?.charAt(0) || "ع"}
          </div>
          <div className="flex-1 text-center md:text-right space-y-1.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">{employee.name}</h1>
              <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-black", statusColor)}>
                {employee.memberState || employee.status || employee.membershipStatus || "—"}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500">{employee.jobTitle || "—"} {employee.workplace ? `| ${employee.workplace}` : ""}</p>
            <p className="text-[10px] font-bold text-slate-400">الرقم الوظيفي: {employee.jobId || "—"}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowUpdate(true)}
              className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 font-black text-xs hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all flex items-center gap-1.5">
              <FileEdit size={14} /> تحديث بياناتي
            </button>
            <button onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-black text-xs hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all flex items-center gap-1.5">
              <LogOut size={14} /> خروج
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoIcon icon={Hash} label="الرقم القومي" value={employee.nationalId || employee.national_id} color="slate" />
          <InfoIcon icon={Phone} label="رقم الموبايل" value={employee.phone || employee.mobile} color="teal" />
          <InfoIcon icon={Building} label="جهة العمل" value={employee.workplace} color="sky" />
          <InfoIcon icon={Briefcase} label="المسمى الوظيفي" value={employee.jobTitle} color="purple" />
          <InfoIcon icon={CalendarDays} label="تاريخ الميلاد" value={bd} color="amber" />
          <InfoIcon icon={Award} label="السن" value={age !== null ? `${age} سنة` : "—"} color="rose" />
          <InfoIcon icon={Star} label="نوع العضوية" value={employee.membershipStatus} color="emerald" />
          <InfoIcon icon={BadgeCheck} label="الحالة" value={employee.memberState || employee.status} color={employee.memberState === "نشط" ? "emerald" : "amber"} />
          <InfoIcon icon={Wallet} label="الاشتراك" value={employee.subscriptionStatus} color="teal" />
        </div>

        {isBoard && (
          <div className={clsx("rounded-2xl border p-5", T.card)}>
            <h2 className="text-sm font-black flex items-center gap-2 mb-4 text-amber-700 dark:text-amber-400">
              <UserCheck size={18} /> عضو مجلس إدارة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoIcon icon={Award} label="المنصب" value={employee.boardRoleTitle || employee.membershipStatus} color="amber" />
              <InfoIcon icon={CalendarDays} label="تاريخ بداية العضوية" value={employee.boardJoinDate || "—"} color="amber" />
              <InfoIcon icon={Info} label="الحالة" value={employee.boardStatus || "نشط"} color="amber" />
            </div>
          </div>
        )}

        {aidChecks.length > 0 && (
          <div className={clsx("rounded-2xl border p-5", T.card)}>
            <h2 className="text-sm font-black flex items-center gap-2 mb-4 text-rose-700 dark:text-rose-400">
              <Heart size={18} /> الإعانات المصروفة
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-right py-2 px-2 font-black text-slate-500">#</th>
                    <th className="text-right py-2 px-2 font-black text-slate-500">النوع</th>
                    <th className="text-right py-2 px-2 font-black text-slate-500">المبلغ</th>
                    <th className="text-right py-2 px-2 font-black text-slate-500">التاريخ</th>
                    <th className="text-right py-2 px-2 font-black text-slate-500">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {aidChecks.map((c, i) => (
                    <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-2 font-bold">{i + 1}</td>
                      <td className="py-2.5 px-2 font-bold">{c.aidCategory || c.aidType || "إعانة"}</td>
                      <td className="py-2.5 px-2 font-black text-emerald-600">{Number(c.amount || 0).toLocaleString()} ج.م</td>
                      <td className="py-2.5 px-2 font-bold">{c.date || c.createdAtIso?.split("T")[0] || "—"}</td>
                      <td className="py-2.5 px-2 text-slate-500">{c.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={() => printMembershipCertificate(employee)}
            className="flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-gradient-to-l from-teal-600 to-teal-500 text-white font-black text-sm shadow-lg hover:from-teal-700 hover:to-teal-600 transition-all">
            <Printer size={18} /> طباعة شهادة قيد
          </button>
          <button onClick={() => setShowUpdate(true)}
            className="flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-black text-sm hover:border-teal-500 hover:text-teal-600 transition-all">
            <FileEdit size={18} /> طلب تحديث البيانات
          </button>
        </div>

        <div className="text-center text-[9px] font-bold text-slate-400 pb-4">
          بوابة العضو — النقابة العامة للعاملين بالاتصالات بالدقهلية
        </div>
      </div>

      {showUpdate && (
        <UpdateRequestModal
          employee={employee}
          onClose={() => setShowUpdate(false)}
          onSuccess={() => { setShowUpdate(false); showToast("تم إرسال طلب التحديث بنجاح، سنتواصل معك قريبًا."); }}
        />
      )}
    </div>
  );
}

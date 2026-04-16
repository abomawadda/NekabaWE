import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KeyRound, LockKeyhole, Phone, ShieldCheck, UserCircle2 } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";

const normalizeDigits = (value = "") =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/\D/g, "");

function LoginInput({ label, icon: Icon, value, onChange, placeholder, type = "text", maxLength }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-slate-500">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          className="w-full pr-10 pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin, loginEmployee } = useAuth();

  const [mode, setMode] = useState("employee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    jobId: "",
    phone: "",
    nationalIdLast4: "",
  });
  const [adminForm, setAdminForm] = useState({
    username: "",
    password: "",
  });

  const redirectTo = location.state?.from?.pathname || "/dashboardpage";

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginEmployee(employeeForm);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginAdmin(adminForm);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={clsx(
        "min-h-screen flex items-center justify-center px-4 py-8 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_transparent_28%),linear-gradient(135deg,#f8fafc,#ecfeff,#f8fafc)]",
        T.text
      )}
      dir="rtl"
    >
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch">
        <div className="rounded-[32px] border border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-6 sm:p-8 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none opacity-70">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-teal-200/40 blur-3xl rounded-full" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-100/60 blur-3xl rounded-full" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <img src="/brand-right-we.svg" alt="شعار we" className="w-24 h-24 object-contain drop-shadow-sm" />
              <img src="/brand-left.png" alt="شعار إضافي" className="w-24 h-24 object-contain drop-shadow-sm" />
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-teal-700 text-sm font-black tracking-wide">النقابة العامة للاتصالات بالدقهلية</p>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">النظام المالي والإداري</h1>
              <p className="text-lg font-black text-amber-600">الإصدار الأول 2026</p>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-500 mb-1">إعداد وتنفيذ</p>
                <p className="text-lg font-black text-slate-900">أ / محمود العراقي</p>
                <p className="text-xs font-bold text-slate-500 mt-1">أمين الصندوق</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50/90 p-4 shadow-sm flex items-center justify-center">
                <p className="text-sm font-black text-teal-900">جاهز لبدء التشغيل المالي والإداري</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-5 sm:p-6">
          <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode("employee");
                setError("");
              }}
              className={clsx(
                "flex-1 py-3 rounded-2xl text-sm font-black transition-all",
                mode === "employee" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              )}
            >
              دخول الأعضاء
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("admin");
                setError("");
              }}
              className={clsx(
                "flex-1 py-3 rounded-2xl text-sm font-black transition-all",
                mode === "admin" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              )}
            >
              مسؤول النظام
            </button>
          </div>

          <div className="mt-6">
            {mode === "employee" ? (
              <form className="space-y-4" onSubmit={handleEmployeeSubmit}>
                <div className="space-y-1">
                  <p className="text-xl font-black text-slate-900">تسجيل دخول الأعضاء</p>
                </div>

                <LoginInput
                  label="إدخال الرقم الوظيفي"
                  icon={UserCircle2}
                  value={employeeForm.jobId}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, jobId: normalizeDigits(e.target.value) }))
                  }
                  placeholder="الرقم الوظيفي المسجل"
                />

                <LoginInput
                  label="رقم الموبايل الأساسي المسجل"
                  icon={Phone}
                  value={employeeForm.phone}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, phone: normalizeDigits(e.target.value).slice(0, 11) }))
                  }
                  placeholder="01xxxxxxxxx"
                  maxLength={11}
                />

                <LoginInput
                  label="آخر أربع أرقام من الرقم القومي"
                  icon={KeyRound}
                  value={employeeForm.nationalIdLast4}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, nationalIdLast4: normalizeDigits(e.target.value).slice(0, 4) }))
                  }
                  placeholder="آخر 4 أرقام"
                  maxLength={4}
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-teal-600 text-white text-sm font-black hover:bg-teal-700 transition-all shadow-lg disabled:opacity-60"
                >
                  {loading ? "جارٍ التحقق..." : "دخول للمشاهدة"}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleAdminSubmit}>
                <div className="space-y-1">
                  <p className="text-xl font-black text-slate-900">دخول مسؤول النظام</p>
                </div>

                <LoginInput
                  label="اسم المستخدم"
                  icon={ShieldCheck}
                  value={adminForm.username}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="اسم المستخدم"
                />

                <LoginInput
                  label="كلمة السر"
                  icon={LockKeyhole}
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="كلمة السر"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all shadow-lg disabled:opacity-60"
                >
                  {loading ? "جارٍ التحقق..." : "دخول مسؤول النظام"}
                </button>
              </form>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

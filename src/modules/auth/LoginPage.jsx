import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  AlertTriangle,
  KeyRound,
  LockKeyhole,
  Phone,
  ShieldCheck,
  UserCircle2,
  UserSquare2,
} from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";

const normalizeDigits = (value = "") =>
  String(value)
    .replace(/[\u0660-\u0669]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
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

function CaptchaBox({ answer, onChange, challenge }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-[11px] font-black text-amber-700">تحقق أمني</p>
      <p className="text-xs font-bold text-amber-900">
        اكتب ناتج العملية التالية: <span className="font-black">{challenge}</span>
      </p>
      <input
        value={answer}
        onChange={onChange}
        placeholder="الإجابة"
        className="w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-xs font-black outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );
}

export default function LoginPage() {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword, loginEmployee } = useAuth();

  const [mode, setMode] = useState("system");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    jobId: "",
    phone: "",
    nationalIdLast4: "",
  });
  const [accountForm, setAccountForm] = useState({
    identifier: "",
    password: "",
  });
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const captcha = useMemo(() => {
    const left = 6;
    const right = 3;
    return {
      label: `${left} + ${right}`,
      answer: String(left + right),
    };
  }, []);

  const redirectTo = location.state?.from?.pathname || "/dashboardpage";

  const ensureCaptcha = () => {
    if (captchaAnswer.trim() !== captcha.answer) {
      throw new Error("فشل التحقق الأمني. أعد كتابة نتيجة العملية الحسابية.");
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      ensureCaptcha();
      await loginEmployee(employeeForm);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      ensureCaptcha();
      await loginWithPassword(accountForm);
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

          <div className="relative z-10 space-y-7">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <img src="/brand-right-we.svg" alt="شعار" className="w-24 h-24 object-contain drop-shadow-sm" />
              <img src="/brand-left.png" alt="هوية" className="w-24 h-24 object-contain drop-shadow-sm" />
            </div>

            <div className="space-y-3">
              <p className="text-teal-700 text-sm font-black tracking-wide">منظومة الأمان والصلاحيات</p>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">الدخول الآمن للنظام</h1>
              <p className="text-sm font-black text-slate-500 leading-7">
                الجلسات الآن تخضع للتحقق من سلامة الجهاز والرمز والجلسات المتزامنة، مع سجل تدقيق كامل لعمليات الدخول والخروج.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-500 mb-1">حماية مفعلة</p>
                <p className="text-sm font-black text-slate-900">Route Guard + Role-Based Permissions</p>
                <p className="text-[11px] font-bold text-slate-500 mt-1">سياسات كلمة مرور + Session Integrity + Audit Log</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50/90 p-4 shadow-sm">
                <p className="text-[11px] font-black text-teal-700 mb-1">رسالة مهمة</p>
                <p className="text-sm font-black text-teal-900 leading-6">
                  بعد 5 محاولات فاشلة يتم قفل الحساب مؤقتًا، لذلك استخدم بياناتك المعتمدة فقط.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-5 sm:p-6">
          <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode("system");
                setError("");
              }}
              className={clsx(
                "flex-1 py-3 rounded-2xl text-sm font-black transition-all",
                mode === "system" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              )}
            >
              حساب نظام
            </button>
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
              دخول عضو
            </button>
          </div>

          <div className="mt-6">
            {mode === "system" ? (
              <form className="space-y-4" onSubmit={handleSystemSubmit}>
                <div className="space-y-1">
                  <p className="text-xl font-black text-slate-900">تسجيل دخول المستخدمين</p>
                  <p className="text-[11px] font-bold text-slate-500">
                    أدخل الهاتف أو البريد الإلكتروني أو اسم المستخدم، ثم كلمة المرور.
                  </p>
                </div>

                <LoginInput
                  label="المعرف"
                  icon={UserSquare2}
                  value={accountForm.identifier}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, identifier: e.target.value }))}
                  placeholder="الهاتف أو البريد الإلكتروني أو اسم المستخدم"
                />

                <LoginInput
                  label="كلمة المرور"
                  icon={LockKeyhole}
                  type="password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="كلمة المرور"
                />

                <CaptchaBox
                  answer={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  challenge={captcha.label}
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold text-slate-600">
                  لا تملك حسابًا بعد؟
                  <Link to="/register" className="text-teal-700 font-black mr-1 hover:underline">
                    إنشاء حساب جديد
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all shadow-lg disabled:opacity-60"
                >
                  {loading ? "جارٍ التحقق..." : "دخول آمن"}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleEmployeeSubmit}>
                <div className="space-y-1">
                  <p className="text-xl font-black text-slate-900">دخول الأعضاء للعرض</p>
                  <p className="text-[11px] font-bold text-slate-500">
                    صلاحية المشاهدة فقط مع تقييد البيانات على ملف العضو نفسه.
                  </p>
                </div>

                <LoginInput
                  label="الرقم الوظيفي"
                  icon={UserCircle2}
                  value={employeeForm.jobId}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({ ...prev, jobId: normalizeDigits(e.target.value) }))
                  }
                  placeholder="الرقم الوظيفي المسجل"
                />

                <LoginInput
                  label="رقم الهاتف"
                  icon={Phone}
                  value={employeeForm.phone}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      phone: normalizeDigits(e.target.value).slice(0, 11),
                    }))
                  }
                  placeholder="01xxxxxxxxx"
                  maxLength={11}
                />

                <LoginInput
                  label="آخر 4 أرقام من الرقم القومي"
                  icon={KeyRound}
                  value={employeeForm.nationalIdLast4}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      nationalIdLast4: normalizeDigits(e.target.value).slice(0, 4),
                    }))
                  }
                  placeholder="آخر 4 أرقام"
                  maxLength={4}
                />

                <CaptchaBox
                  answer={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  challenge={captcha.label}
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-teal-600 text-white text-sm font-black hover:bg-teal-700 transition-all shadow-lg disabled:opacity-60"
                >
                  {loading ? "جارٍ التحقق..." : "دخول للعرض"}
                </button>
              </form>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

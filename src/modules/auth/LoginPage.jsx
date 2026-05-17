import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck, UserSquare2, UserCheck } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";

function Field({ label, icon: Icon, ...props }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-black text-slate-500">{label}</span>
      <div className="relative">
        <Icon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          {...props}
          className="w-full pr-10 pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
        />
      </div>
    </label>
  );
}

export default function LoginPage() {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword } = useAuth();

  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = location.state?.from?.pathname || "/dashboardpage";

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithPassword(form);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={clsx(
        "min-h-screen bg-[linear-gradient(150deg,#f8fafc,#ecfeff,#f8fafc)] flex items-center justify-center p-4",
        T.text
      )}
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-5 sm:p-7">
        <div className="flex items-center justify-between mb-6">
          <img src="/brand-left.png" alt="الهوية" className="w-16 h-16 object-contain" />
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-5">تسجيل الدخول</h1>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field
            label="المعرف"
            icon={UserSquare2}
            value={form.identifier}
            onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
            placeholder="الهاتف أو البريد الإلكتروني أو اسم المستخدم"
            autoComplete="username"
          />

          <Field
            label="كلمة المرور"
            icon={LockKeyhole}
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="كلمة المرور"
            autoComplete="current-password"
          />

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all disabled:opacity-60"
          >
            {loading ? "جارٍ التحقق..." : "دخول"}
          </button>
        </form>

        <div className="mt-5 text-center text-[11px] font-bold text-slate-500">
          لا تملك حسابًا؟
          <Link to="/register" className="text-teal-700 font-black mr-1 hover:underline">
            طلب حساب جديد
          </Link>
        </div>

        <div className="mt-3 text-center">
          <Link to="/member-portal" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 text-[11px] font-black hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all">
            <UserCheck size={14} /> بوابة العضو (بدون تسجيل دخول)
          </Link>
        </div>
      </div>
    </div>
  );
}


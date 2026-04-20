import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { validatePasswordPolicy } from "../../security/passwordPolicy";

function InputField({ label, icon: Icon, ...props }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-black text-slate-500">{label}</span>
      <div className="relative">
        <Icon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          {...props}
          className="w-full pr-10 pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
    </label>
  );
}

export default function RegistrationPage() {
  const T = useT();
  const navigate = useNavigate();
  const { registerAccount } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordCheck = validatePasswordPolicy(form.password, form);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await registerAccount(form);
      setSuccess("تم إرسال طلب الحساب بنجاح. سيقوم الأدمن بتفعيل الحساب وتحديد الصلاحيات.");
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (submitError) {
      setError(submitError.message || "تعذر إرسال طلب الحساب.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={clsx(
        "min-h-screen bg-[linear-gradient(150deg,#f8fafc,#eff6ff,#f8fafc)] flex items-center justify-center p-4",
        T.text
      )}
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-5 sm:p-7">
        <div className="flex items-center justify-between mb-6">
          <img src="/brand-left.png" alt="الهوية" className="w-16 h-16 object-contain" />
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">طلب حساب جديد</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <InputField
            label="الاسم الكامل"
            icon={UserRound}
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            placeholder="الاسم الرباعي"
          />

          <InputField
            label="رقم الهاتف"
            icon={Phone}
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="01xxxxxxxxx"
          />

          <InputField
            label="البريد الإلكتروني (اختياري)"
            icon={Mail}
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="name@example.com"
          />

          <InputField
            label="كلمة المرور"
            icon={LockKeyhole}
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="كلمة المرور"
          />

          <InputField
            label="تأكيد كلمة المرور"
            icon={LockKeyhole}
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="أعد كتابة كلمة المرور"
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black text-slate-600">
            {passwordCheck.valid
              ? "كلمة المرور مطابقة للسياسة."
              : passwordCheck.errors[0] || "أدخل كلمة مرور قوية."}
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-sky-600 text-white text-sm font-black hover:bg-sky-700 transition-all disabled:opacity-60"
          >
            {submitting ? "جارٍ إرسال الطلب..." : "إرسال طلب الحساب"}
          </button>
        </form>

        <div className="mt-5 text-center text-[11px] font-bold text-slate-500">
          لديك حساب بالفعل؟
          <Link to="/login" className="text-sky-700 font-black mr-1 hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}


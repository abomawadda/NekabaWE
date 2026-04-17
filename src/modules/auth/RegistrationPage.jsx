import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImagePlus, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { PASSWORD_POLICY_HINTS, validatePasswordPolicy } from "../../security/passwordPolicy";
import { ROLE_OPTIONS } from "../../security/permissions";

function InputField({ label, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-slate-500">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute right-3 top-3 text-slate-400" />
        <div className="pr-10">{children}</div>
      </div>
    </div>
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
    role: "viewer",
    acceptedTerms: false,
    profileFile: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordCheck = validatePasswordPolicy(form.password, form);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const result = await registerAccount(form);
      setSuccess(`تم إنشاء الحساب بنجاح. اسم المستخدم المقترح: ${result.username}`);
      window.setTimeout(() => navigate("/login"), 1000);
    } catch (submitError) {
      setError(submitError.message || "تعذر إنشاء الحساب.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={clsx(
        "min-h-screen px-4 py-8 bg-[linear-gradient(135deg,#f8fafc,#eff6ff,#f8fafc)]",
        T.text
      )}
      dir="rtl"
    >
      <div className="max-w-4xl mx-auto rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)] overflow-hidden">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-8 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_30%),linear-gradient(180deg,#eff6ff,#f8fafc)] border-l border-slate-100 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-black text-slate-900">إنشاء حساب جديد</h1>
              <p className="text-sm font-bold text-slate-500 leading-7">
                أنشئ حسابًا جديدًا مع دور واضح وسياسة كلمة مرور مهنية وسجل تدقيق لحظة التسجيل.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 space-y-3">
              <p className="text-xs font-black text-slate-800">سياسة كلمة المرور</p>
              <div className="space-y-2">
                {PASSWORD_POLICY_HINTS.map((hint) => (
                  <div key={hint} className="text-[11px] font-bold text-slate-500">
                    {hint}
                  </div>
                ))}
              </div>
            </div>

            <Link to="/login" className="inline-flex text-sm font-black text-sky-700 hover:underline">
              العودة إلى شاشة الدخول
            </Link>
          </div>

          <form className="p-8 space-y-5" onSubmit={handleSubmit}>
            <div className="grid sm:grid-cols-2 gap-4">
              <InputField label="الاسم الكامل" icon={UserRound}>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="الاسم الرباعي"
                />
              </InputField>

              <InputField label="رقم الهاتف" icon={Phone}>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="01xxxxxxxxx"
                />
              </InputField>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <InputField label="البريد الإلكتروني" icon={Mail}>
                <input
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="name@example.com"
                />
              </InputField>

              <InputField label="الدور" icon={ShieldCheck}>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </InputField>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <InputField label="كلمة المرور" icon={LockKeyhole}>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="كلمة المرور"
                />
              </InputField>

              <InputField label="تأكيد كلمة المرور" icon={LockKeyhole}>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="أعد كتابة كلمة المرور"
                />
              </InputField>
            </div>

            <InputField label="الصورة الشخصية - اختيارية" icon={ImagePlus}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, profileFile: e.target.files?.[0] || null }))
                }
                className="w-full pl-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
              />
            </InputField>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-black text-slate-700 mb-2">تقييم كلمة المرور</p>
              <p className={clsx("text-[11px] font-bold", passwordCheck.valid ? "text-emerald-600" : "text-amber-600")}>
                {passwordCheck.valid
                  ? "كلمة المرور مطابقة للسياسة."
                  : passwordCheck.errors[0] || "اكتب كلمة المرور لمراجعتها."}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, acceptedTerms: e.target.checked }))
                }
                className="mt-1 accent-sky-600"
              />
              <span className="text-sm font-bold text-slate-600 leading-7">
                أوافق على سياسة الاستخدام وشروط الحماية، وأتعهد بعدم مشاركة بيانات الدخول أو استخدام النظام خارج نطاق العمل.
              </span>
            </label>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-sky-600 text-white text-sm font-black hover:bg-sky-700 transition-all shadow-lg disabled:opacity-60"
            >
              {submitting ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

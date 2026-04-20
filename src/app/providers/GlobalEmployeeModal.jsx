import React, { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  UserCircle,
  Phone,
  Hash,
  MessageSquare,
  Eye,
  Mail,
  Shield,
  Building2,
} from "lucide-react";
import clsx from "clsx";
import { useT } from "./ThemeProvider";

/* =========================
   Context
========================= */
const EmployeeModalContext = createContext();

export const useEmployeeModal = () => useContext(EmployeeModalContext);

/* =========================
   Helpers (Clean + Reusable)
========================= */

// تنظيف رقم الهاتف (يدعم مصر تلقائي)
const formatPhone = (phone) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "20" + cleaned.slice(1);
  }

  return cleaned;
};

// رسالة واتساب جاهزة
const buildWhatsAppURL = (phone, name) => {
  const message = encodeURIComponent(
    `مرحباً ${name} 👋\nنرجو التواصل بخصوص بياناتك في النظام.`
  );

  return `https://wa.me/${formatPhone(phone)}?text=${message}`;
};

// رابط الإيميل
const buildMailURL = (email, name) => {
  const subject = encodeURIComponent("طلب تواصل من النظام");
  const body = encodeURIComponent(
    `مرحباً ${name}\n\nنرجو مراجعة بياناتك في النظام.\n\nشكراً لك`
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
};

const resolveEmployeeRouteId = (employee = {}) =>
  String(
    employee?.id ||
      employee?.employeeId ||
      employee?.memberId ||
      employee?.jobId ||
      ""
  ).trim();

/* =========================
   Provider
========================= */
export const GlobalEmployeeModalProvider = ({ children }) => {
  const T = useT();
  const navigate = useNavigate();

  const [selectedEmp, setSelectedEmp] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const openEmployeeModal = (emp) => {
    setSelectedEmp(emp);
    setIsOpen(true);
  };

  const closeEmployeeModal = () => {
    setIsOpen(false);
    setTimeout(() => setSelectedEmp(null), 250);
  };

  return (
    <EmployeeModalContext.Provider
      value={{ openEmployeeModal, closeEmployeeModal }}
    >
      {children}

      {isOpen && selectedEmp && (
        <div
          onClick={closeEmployeeModal}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300"
          dir="rtl"
        >
          {/* Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              "w-full max-w-sm rounded-[2rem] shadow-2xl ring-1 ring-black/5 overflow-hidden animate-in zoom-in-95 duration-300",
              T.card
            )}
          >
            {/* Header */}
            <div className="h-28 bg-gradient-to-r from-teal-500 to-emerald-500 relative">
              <button
                onClick={closeEmployeeModal}
                className="absolute top-4 left-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile */}
            <div className="px-6 flex flex-col items-center -mt-14 mb-4 relative z-10">
              <div className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-lg overflow-hidden">
                {selectedEmp.photo ? (
                  <img
                    src={selectedEmp.photo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle size={56} className="text-teal-500" />
                )}
              </div>

              <h3 className="text-xl font-black mt-3 text-center">
                {selectedEmp.name}
              </h3>

              {/* Badges */}
              <div className="flex gap-2 mt-2 flex-wrap justify-center">
                <span className="text-[11px] font-black text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-900/40 px-3 py-1 rounded-lg">
                  {selectedEmp.jobTitle || "بدون وظيفة"}
                </span>

                {selectedEmp.membershipStatus && (
                  <span className="text-[11px] font-black px-3 py-1 rounded-lg flex items-center gap-1 bg-slate-100 dark:bg-slate-800">
                    <Shield size={12} />
                    {selectedEmp.membershipStatus}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <Building2 size={12} />
                {selectedEmp.workplace || "غير محدد"}
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 space-y-3">
              {/* WhatsApp */}
              {selectedEmp.phone ? (
                <a
                  href={buildWhatsAppURL(
                    selectedEmp.phone,
                    selectedEmp.name
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 border transition group"
                >
                  <div className="p-2.5 bg-white/70 dark:bg-emerald-800/50 rounded-lg group-hover:scale-110 transition">
                    <MessageSquare size={18} />
                  </div>

                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-black opacity-70">
                      واتساب
                    </p>
                    <p className="text-sm font-bold" dir="ltr">
                      {selectedEmp.phone}
                    </p>
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 text-slate-400">
                  <Phone size={18} />
                  <p className="text-xs">لا يوجد رقم</p>
                </div>
              )}

              {/* Email */}
              {selectedEmp.email && (
                <a
                  href={buildMailURL(
                    selectedEmp.email,
                    selectedEmp.name
                  )}
                  className="flex items-center gap-4 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border transition group"
                >
                  <div className="p-2.5 bg-white/70 dark:bg-blue-800/50 rounded-lg group-hover:scale-110 transition">
                    <Mail size={18} />
                  </div>

                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-black opacity-70">
                      البريد الإلكتروني
                    </p>
                    <p className="text-sm font-bold truncate">
                      {selectedEmp.email}
                    </p>
                  </div>
                </a>
              )}

              {/* Job ID */}
              {selectedEmp.jobId && (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <Hash size={18} />
                  <div className="flex-1 text-right">
                    <p className="text-[10px] text-slate-400">
                      الكود الوظيفي
                    </p>
                    <p className="text-sm font-bold">
                      {selectedEmp.jobId}
                    </p>
                  </div>
                </div>
              )}

              {/* View Profile */}
              <button
                onClick={() => {
                  closeEmployeeModal();
                  // مثال ربط مع Node route
                  const routeId = resolveEmployeeRouteId(selectedEmp);
                  if (!routeId) return;
                  navigate(`/employees/${routeId}`);
                }}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                <Eye size={18} />
                عرض الملف الكامل
              </button>
            </div>
          </div>
        </div>
      )}
    </EmployeeModalContext.Provider>
  );
};

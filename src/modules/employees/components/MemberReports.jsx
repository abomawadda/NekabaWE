import React, { useState, useMemo } from "react";
import { printMemberReport } from "../helpers/memberReportPrint";
import { useT } from "../../../app/providers/ThemeProvider";
import clsx from "clsx";
import { X, Printer, BarChart3, Filter, Users, FileText } from "lucide-react";

const GROUP_OPTIONS = [
  { value: "none", label: "بدون تجميع" },
  { value: "workplace", label: "جهة العمل" },
  { value: "jobGrade", label: "الدرجة الوظيفية" },
  { value: "memberState", label: "الحالة" },
  { value: "membershipStatus", label: "نوع العضوية" },
  { value: "gender", label: "الجنس" },
];

export default function MemberReports({ employees, onClose }) {
  const T = useT();
  const [groupBy, setGroupBy] = useState("none");
  const [showInactive, setShowInactive] = useState(true);

  const filteredEmployees = useMemo(() => {
    if (showInactive) return employees;
    return employees.filter((e) => {
      const state = e.memberState?.trim() || "نشط";
      return !["معاش", "وفاة", "استقالة"].includes(state);
    });
  }, [employees, showInactive]);

  const counts = useMemo(() => {
    const total = filteredEmployees.length;
    const active = filteredEmployees.filter((e) => (e.memberState?.trim() || "نشط") === "نشط").length;
    const male = filteredEmployees.filter((e) => e.gender === "ذكر").length;
    const female = filteredEmployees.filter((e) => e.gender === "أنثى").length;
    return { total, active, male, female };
  }, [filteredEmployees]);

  const handlePrint = () => {
    printMemberReport({
      employees: filteredEmployees,
      groupBy,
      title: "كشف أعضاء الجمعية العمومية",
    });
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx("w-full max-w-lg rounded-3xl border shadow-2xl", T.card)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-purple-500" />
            <h2 className="font-black text-sm">تقارير الجمعية العمومية</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 text-center">
              <div className="text-xl font-black text-indigo-600">{counts.total}</div>
              <div className="text-[9px] font-bold text-indigo-400">الإجمالي</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-center">
              <div className="text-xl font-black text-emerald-600">{counts.active}</div>
              <div className="text-[9px] font-bold text-emerald-400">نشط</div>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/40 text-center">
              <div className="text-xl font-black text-sky-600">{counts.male}</div>
              <div className="text-[9px] font-bold text-sky-400">ذكور</div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-center">
              <div className="text-xl font-black text-rose-600">{counts.female}</div>
              <div className="text-[9px] font-bold text-rose-400">إناث</div>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border">
            <p className="font-black text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Filter size={13} /> خيارات التقرير
            </p>

            <div>
              <label className="text-[9px] font-bold text-slate-500 block mb-2">تجميع حسب</label>
              <div className="grid grid-cols-3 gap-2">
                {GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={clsx(
                      "px-3 py-2 rounded-xl text-[10px] font-black border transition-all",
                      groupBy === opt.value
                        ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:text-purple-600"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-[10px] font-bold text-slate-500">عرض الأعضاء غير النشطين (معاش/وفاة/استقالة)</span>
            </label>
          </div>

          <button
            onClick={handlePrint}
            className="w-full py-3 rounded-xl text-[11px] font-black bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <Printer size={15} /> طباعة كشف الجمعية العمومية
          </button>
        </div>
      </div>
    </div>
  );
}

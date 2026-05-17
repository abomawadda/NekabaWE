import React, { useState, useMemo } from "react";
import { printMemberReport } from "../helpers/memberReportPrint";
import { useT } from "../../../app/providers/ThemeProvider";
import clsx from "clsx";
import { X, Printer, Users, UserX, UserMinus, List } from "lucide-react";

const GENERAL_TYPES = ["عضو جمعية عمومية", "رئيس المجلس", "الأمين العام", "أمين الصندوق", "نائب الرئيس", "عضو مجلس إدارة", "عضو مجلس"];

const PRESETS = [
  {
    id: "general",
    label: "الجمعية العمومية",
    desc: "الأعضاء النشطين فقط (بدون مستقلة ومعاش/وفاة)",
    icon: Users,
    filter: (emp) => {
      const state = emp.memberState?.trim() || "نشط";
      return !["معاش", "وفاة", "استقالة"].includes(state) && emp.membershipStatus !== "نقابة مستقلة";
    },
    color: "bg-teal-500 text-white border-teal-500",
    hoverColor: "hover:border-teal-400 hover:text-teal-600",
    title: "كشف أعضاء الجمعية العمومية",
  },
  {
    id: "independent",
    label: "نقابة مستقلة",
    desc: "أعضاء النقابة المستقلة (نشطون)",
    icon: UserMinus,
    filter: (emp) => {
      const state = emp.memberState?.trim() || "نشط";
      return !["معاش", "وفاة", "استقالة"].includes(state) && emp.membershipStatus === "نقابة مستقلة";
    },
    color: "bg-amber-500 text-white border-amber-500",
    hoverColor: "hover:border-amber-400 hover:text-amber-600",
    title: "كشف نقابة مستقلة",
  },
  {
    id: "retired",
    label: "معاش / وفاة",
    desc: "المحالون للمعاش والمتوفون",
    icon: UserX,
    filter: (emp) => {
      const state = emp.memberState?.trim() || "";
      return ["معاش", "وفاة"].includes(state);
    },
    color: "bg-rose-500 text-white border-rose-500",
    hoverColor: "hover:border-rose-400 hover:text-rose-600",
    title: "كشف المحالين للمعاش والوفاة",
  },
  {
    id: "all",
    label: "كشف كامل",
    desc: "جميع الأعضاء بدون استثناء",
    icon: List,
    filter: () => true,
    color: "bg-indigo-500 text-white border-indigo-500",
    hoverColor: "hover:border-indigo-400 hover:text-indigo-600",
    title: "كشف جميع الأعضاء",
  },
];

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
  const [selectedPreset, setSelectedPreset] = useState("general");
  const [groupBy, setGroupBy] = useState("none");

  const preset = PRESETS.find((p) => p.id === selectedPreset) || PRESETS[0];

  const filteredEmployees = useMemo(() => {
    return employees.filter(preset.filter);
  }, [employees, preset]);

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
      title: preset.title,
    });
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx("w-full max-w-xl rounded-3xl border shadow-2xl", T.card)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Printer size={20} className="text-purple-500" />
            <h2 className="font-black text-sm">تقارير الجمعية العمومية</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const isActive = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPreset(p.id)}
                  className={clsx(
                    "p-3 rounded-2xl border text-right transition-all",
                    isActive ? p.color : "bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 " + p.hoverColor
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="font-black text-xs">{p.label}</span>
                  </div>
                  <p className={clsx("text-[9px] font-bold mt-1", isActive ? "text-white/80" : "text-slate-400")}>{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className={clsx("p-2 rounded-xl border text-center", preset.id === PRESETS[0].id ? "border-teal-200 bg-teal-50" : "border-slate-200")}>
              <div className="text-lg font-black text-slate-700">{counts.total}</div>
              <div className="text-[8px] font-bold text-slate-400">إجمالي</div>
            </div>
            <div className={clsx("p-2 rounded-xl border text-center", preset.id === PRESETS[0].id ? "border-teal-200 bg-teal-50" : "border-slate-200")}>
              <div className="text-lg font-black text-emerald-600">{counts.active}</div>
              <div className="text-[8px] font-bold text-slate-400">نشط</div>
            </div>
            <div className="p-2 rounded-xl border border-sky-200 bg-sky-50 text-center">
              <div className="text-lg font-black text-sky-600">{counts.male}</div>
              <div className="text-[8px] font-bold text-slate-400">ذكور</div>
            </div>
            <div className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-center">
              <div className="text-lg font-black text-rose-600">{counts.female}</div>
              <div className="text-[8px] font-bold text-slate-400">إناث</div>
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border">
            <p className="font-black text-[10px] text-slate-500">خيارات التقرير</p>
            <div className="flex gap-1.5 flex-wrap">
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt.value)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all",
                    groupBy === opt.value
                      ? "bg-purple-500 text-white border-purple-500"
                      : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:text-purple-600"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="w-full py-3 rounded-xl text-[11px] font-black bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <Printer size={15} /> طباعة: {preset.label}
          </button>
        </div>
      </div>
    </div>
  );
}

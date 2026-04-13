/**
 * ReportBuilder — محرك التقارير الذكي (Smart Reporting Engine)
 * ✅ وحدات تقارير جديدة: الإعانات، الأنشطة، التفصيلي
 * ✅ إصلاح: حساب إجماليات الجدول (colspan bug)
 * ✅ تحسين: بطاقات ملخص قبل الجدول
 * ✅ تحسين: توافق كامل مع الموبايل
 * ✅ تحسين: تصميم احترافي
 * ✅ Error boundary — لا صفحات بيضاء
 */

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import BrandHeader from "../../ui/BrandHeader";
import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import * as XLSX from "xlsx";
import {
  FileText, Printer, Download, Filter, Columns, Calendar,
  CheckCircle2, AlertCircle, RefreshCw, Layers, SlidersHorizontal,
  TableProperties, TrendingUp, TrendingDown, Users, Activity,
  Heart, DollarSign, Wallet, AlertTriangle, X, ChevronDown, ChevronUp
} from "lucide-react";
import clsx from "clsx";

// ════════════════════════════════════════════════════════════
// ⚙️ وحدات التقارير (Modules)
// ════════════════════════════════════════════════════════════
const REPORT_MODULES = {
  transactions: {
    id:          "transactions",
    title:       "حركات الخزينة (كاملة)",
    icon:        Wallet,
    collection:  "transactions",
    dateField:   "date",
    color:       "indigo",
    fields: [
      { key: "date",    label: "التاريخ" },
      { key: "type",    label: "النوع",    format: v => ({ deposit:"إيداع", advance:"سلفة", aid:"إعانة", activity:"شيك نشاط" }[v] || v) },
      { key: "checkNum",label: "رقم الشيك" },
      { key: "amount",  label: "المبلغ",   isCurrency: true },
      { key: "party",   label: "الجهة / المستفيد" },
      { key: "notes",   label: "البيان" },
      { key: "state",   label: "الحالة",   format: v => v === "posted" ? "مرحّل" : "مسودة" },
    ],
  },
  aids: {
    id:         "aids",
    title:      "تقرير الإعانات",
    icon:       Heart,
    collection: "transactions",
    dateField:  "date",
    color:      "rose",
    filter:     row => row.type === "aid",
    fields: [
      { key: "date",        label: "التاريخ" },
      { key: "party",       label: "العضو المستفيد" },
      { key: "employeeId",  label: "كود العضو" },
      { key: "aidCategory", label: "نوع الإعانة" },
      { key: "aidRel",      label: "صلة القرابة" },
      { key: "amount",      label: "المبلغ", isCurrency: true },
      { key: "checkNum",    label: "رقم الشيك" },
      { key: "incidentDate",label: "تاريخ الواقعة" },
    ],
  },
  activities: {
    id:         "activities",
    title:      "تقرير الأنشطة والفعاليات",
    icon:       Activity,
    collection: "transactions",
    dateField:  "date",
    color:      "amber",
    filter:     row => row.type === "activity",
    fields: [
      { key: "date",              label: "تاريخ الصرف" },
      { key: "activityName",      label: "اسم الفاعلية" },
      { key: "activityType",      label: "نوع الفاعلية" },
      { key: "activityDate",      label: "موعد الفاعلية" },
      { key: "activityLocation",  label: "الموقع" },
      { key: "party",             label: "المسؤول" },
      { key: "participantsCount", label: "عدد المشاركين" },
      { key: "amount",            label: "قيمة الشيك", isCurrency: true },
      { key: "checkNum",          label: "رقم الشيك" },
    ],
  },
  employees: {
    id:         "employees",
    title:      "سجل الأعضاء",
    icon:       Users,
    collection: "employees",
    dateField:  null,
    color:      "teal",
    fields: [
      { key: "jobId",            label: "كود العضو" },
      { key: "name",             label: "الاسم الرباعي" },
      { key: "phone",            label: "رقم الهاتف" },
      { key: "nationalId",       label: "الرقم القومي" },
      { key: "jobTitle",         label: "المسمى الوظيفي" },
      { key: "workplace",        label: "مكان العمل" },
      { key: "grade",            label: "الدرجة" },
      { key: "membershipStatus", label: "الحالة" },
      { key: "subscriptionStatus",label: "الاشتراك" },
    ],
  },
  bookings: {
    id:         "bookings",
    title:      "حجوزات الفعاليات",
    icon:       Calendar,
    collection: "event_bookings",
    dateField:  "eventDate",
    color:      "purple",
    fields: [
      { key: "eventDate",      label: "تاريخ الفعالية" },
      { key: "eventTitle",     label: "اسم الفعالية" },
      { key: "memberName",     label: "المشترك الأساسي" },
      { key: "totalPax",       label: "إجمالي الأفراد" },
      { key: "totalCost",      label: "التكلفة الكلية", isCurrency: true },
      { key: "paymentSummary", label: "طرق الدفع" },
      { key: "status",         label: "حالة الحجز", format: v => v === "confirmed" ? "مؤكد" : v === "cancelled" ? "ملغي" : "معلق" },
    ],
  },
};

// ════════════════════════════════════════════════════════════
// 🖨️ محرك الطباعة
// ════════════════════════════════════════════════════════════
const printReport = (data, config, selectedFieldKeys) => {
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }

  const fields = config.fields.filter(f => selectedFieldKeys.includes(f.key));
  const printDate = new Date().toLocaleString("ar-EG");
  const ModIcon = config.icon;

  // إجماليات الأعمدة المالية
  const currencyFields = fields.filter(f => f.isCurrency);
  const totals = {};
  currencyFields.forEach(f => {
    totals[f.key] = data.reduce((s, r) => s + Number(r[f.key] || 0), 0);
  });

  const headers = fields.map(f => `<th>${f.label}</th>`).join("");
  const rows = data.map((row, i) => {
    const cells = fields.map(f => {
      let val = row[f.key];
      if (f.format) val = f.format(val);
      if (f.isCurrency) val = `<span style="color:#059669; font-weight:900;">${Number(val || 0).toLocaleString()} ج.م</span>`;
      return `<td>${val ?? "—"}</td>`;
    }).join("");
    return `<tr${i % 2 === 0 ? "" : ' style="background:#f8fafc;"'}><td style="text-align:center; font-weight:bold;">${i + 1}</td>${cells}</tr>`;
  }).join("");

  const totalsRow = currencyFields.length > 0 ? `
    <tr class="totals-row">
      <td colspan="${fields.length - currencyFields.length + 1}" style="text-align:right; padding-left:20px;">إجمالي:</td>
      ${currencyFields.map(f => `<td style="color:#059669; text-align:right;">${totals[f.key].toLocaleString()} ج.م</td>`).join("")}
    </tr>
  ` : "";

  win.document.write(`
    <!DOCTYPE html><html lang="ar" dir="rtl">
    <head><meta charset="UTF-8"><title>تقرير ${config.title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
      @page { size:A4 landscape; margin:12mm; }
      * { font-family:'Cairo',sans-serif; box-sizing:border-box; margin:0; padding:0; }
      body { padding:15px; font-size:11px; color:#1e293b; background:#fff; position:relative; }
      body::before { content:"${config.title}"; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); font-size:80px; font-weight:900; color:rgba(100,116,139,0.04); z-index:-1; white-space:nowrap; }
      .info-bar { display:flex; justify-content:space-between; background:#f1f5f9; padding:6px 10px; border-radius:6px; margin-bottom:15px; font-size:10px; font-weight:700; }
      table { width:100%; border-collapse:collapse; margin-bottom:25px; }
      th { background:#1e293b; color:#fff; padding:8px 6px; text-align:right; font-size:11px; border:1px solid #334155; }
      th:first-child { text-align:center; width:35px; }
      td { padding:6px 8px; border:1px solid #cbd5e1; font-size:10px; vertical-align:middle; }
      .totals-row td { background:#f1f5f9; font-weight:900; font-size:12px; border-top:3px solid #1e293b; }
      .signatures { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-top:50px; page-break-inside:avoid; }
      .sig-block { text-align:center; }
      .sig-line  { border-bottom:1px dashed #94a3b8; height:40px; margin-bottom:8px; width:80%; margin-inline:auto; }
      .sig-title { font-size:11px; font-weight:900; color:#334155; }
      ${getPrintBrandStyles()}
    </style></head>
    <body>
      ${getPrintBrandHeader({ reportTitle: config.title, reportMeta: `إجمالي السجلات: ${data.length} | تاريخ التقرير: ${printDate}` })}
      <table>
        <thead><tr><th>#</th>${headers}</tr></thead>
        <tbody>${rows}${totalsRow}</tbody>
      </table>
      <div class="signatures">
        ${["مُدخل البيانات","المراجعة المالية","أمين الصندوق","رئيس النقابة"].map(s => `
          <div class="sig-block"><div class="sig-line"></div><div class="sig-title">${s}</div></div>
        `).join("")}
      </div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),500);}</script>
    </body></html>
  `);
  win.document.close();
};

// ════════════════════════════════════════════════════════════
// Error Boundary
// ════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center p-20 gap-3 text-rose-500">
        <AlertTriangle size={36}/>
        <p className="font-black text-sm">حدث خطأ في تحميل محرك التقارير</p>
        <p className="text-[10px] font-bold opacity-70">{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl font-black text-xs mt-2">
          إعادة المحاولة
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════
function ReportBuilderInner() {
  const T = useT();

  const [selectedModule, setSelectedModule] = useState("transactions");
  const [data, setData]                     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [dateRange, setDateRange]           = useState({ from: "", to: "" });
  const [selectedFields, setSelectedFields] = useState([]);
  const [showConfig, setShowConfig]         = useState(true);

  const activeConfig = REPORT_MODULES[selectedModule];

  // تهيئة الأعمدة عند تغيير الوحدة
  useEffect(() => {
    setSelectedFields(activeConfig.fields.map(f => f.key));
    setDateRange({ from: "", to: "" });
  }, [selectedModule]);

  // جلب البيانات
  useEffect(() => {
    setLoading(true);
    try {
      const q = query(collection(db, activeConfig.collection));
      const unsub = onSnapshot(q, snap => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, err => {
        console.error(err);
        setLoading(false);
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [activeConfig.collection]);

  // فلترة البيانات
  const filteredData = useMemo(() => {
    let rows = [...data];

    // فلتر نوع محدد (للإعانات، الأنشطة)
    if (activeConfig.filter) {
      rows = rows.filter(activeConfig.filter);
    }

    // فلتر التاريخ
    if (activeConfig.dateField && dateRange.from) {
      rows = rows.filter(r => r[activeConfig.dateField] >= dateRange.from);
    }
    if (activeConfig.dateField && dateRange.to) {
      rows = rows.filter(r => r[activeConfig.dateField] <= dateRange.to);
    }

    return rows;
  }, [data, dateRange, activeConfig]);

  // إجماليات سريعة
  const summary = useMemo(() => {
    const currencyFields = activeConfig.fields.filter(f => f.isCurrency);
    const totals = {};
    currencyFields.forEach(f => {
      totals[f.key] = filteredData.reduce((s, r) => s + Number(r[f.key] || 0), 0);
    });
    return { count: filteredData.length, totals, currencyFields };
  }, [filteredData, activeConfig]);

  const toggleField = key => {
    setSelectedFields(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
    );
  };

  const exportToExcel = () => {
    const fields = activeConfig.fields.filter(f => selectedFields.includes(f.key));
    const rows = filteredData.map((row, i) => {
      const obj = { "#": i + 1 };
      fields.forEach(f => {
        let val = row[f.key];
        if (f.format) val = f.format(val);
        obj[f.label] = val ?? "";
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = [{ wch: 5 }, ...fields.map(() => ({ wch: 20 }))];
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeConfig.title.substring(0, 30));
    XLSX.writeFile(wb, `${activeConfig.title}_${new Date().toLocaleDateString("en")}.xlsx`);
  };

  const ModIcon = activeConfig.icon || TableProperties;
  const accentColor = activeConfig.color || "indigo";

  // ─── Render ──────────────────────────────────
  return (
    <div className={clsx("max-w-7xl mx-auto space-y-4 pb-20 animate-in fade-in duration-500", T.text)} dir="rtl">
      <BrandHeader sectionTitle="محرك التقارير المخصصة" sectionHint="فلترة متقدمة وتخصيص أعمدة وتصدير" />

      {/* ── رأس الصفحة ── */}
      <div className={clsx(
        "p-5 rounded-2xl border shadow-sm text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
        `bg-gradient-to-l from-${accentColor}-700 to-${accentColor}-900`
      )}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
            <ModIcon size={24}/>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">محرك التقارير المخصصة</h1>
            <p className="text-xs font-bold opacity-80 mt-0.5">فلترة متقدمة · تخصيص أعمدة · تصدير PDF / Excel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            "text-[10px] font-black px-3 py-1.5 rounded-xl",
            "bg-white/20 backdrop-blur-sm"
          )}>
            {activeConfig.title}
          </span>
        </div>
      </div>

      {/* ── Grid الرئيسي ── */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── لوحة الإعدادات ── */}
        <div className={clsx(
          "lg:w-64 shrink-0 space-y-3 transition-all",
          !showConfig && "lg:w-12"
        )}>
          {/* زر إخفاء الإعدادات */}
          <button onClick={() => setShowConfig(p => !p)}
            className={clsx("hidden lg:flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-teal-600 transition-all w-full", !showConfig && "justify-center")}>
            <SlidersHorizontal size={14}/>
            {showConfig && "إخفاء الإعدادات"}
          </button>

          {showConfig && (
            <>
              {/* اختيار الوحدة */}
              <div className={clsx("p-4 rounded-2xl border shadow-sm space-y-2", T.card)}>
                <h3 className="text-[10px] font-black flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-slate-800">
                  <Layers size={13} className={`text-${accentColor}-500`}/> مصدر البيانات
                </h3>
                <div className="flex flex-col gap-1.5 pt-1">
                  {Object.values(REPORT_MODULES).map(mod => {
                    const Icon = mod.icon;
                    const active = selectedModule === mod.id;
                    return (
                      <button key={mod.id} onClick={() => setSelectedModule(mod.id)}
                        className={clsx(
                          "p-2.5 rounded-xl text-right text-[10px] font-black transition-all border flex items-center gap-2",
                          active
                            ? `bg-${mod.color}-50 border-${mod.color}-400 text-${mod.color}-700 dark:bg-${mod.color}-900/20 dark:text-${mod.color}-400`
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                        )}>
                        <Icon size={13} className={active ? `text-${mod.color}-600` : "text-slate-400"}/>
                        <span className="truncate">{mod.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* فلتر التاريخ */}
              {activeConfig.dateField && (
                <div className={clsx("p-4 rounded-2xl border shadow-sm space-y-3", T.card)}>
                  <h3 className="text-[10px] font-black flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-slate-800">
                    <Calendar size={13} className={`text-${accentColor}-500`}/> النطاق الزمني
                  </h3>
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-1">من تاريخ:</label>
                      <ArabicDatePicker label="" value={dateRange.from}
                        onChange={v => setDateRange(p => ({ ...p, from: v }))}
                        maxVal={dateRange.to || undefined}/>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-1">إلى تاريخ:</label>
                      <ArabicDatePicker label="" value={dateRange.to}
                        onChange={v => setDateRange(p => ({ ...p, to: v }))}
                        minVal={dateRange.from || undefined}/>
                    </div>
                    {(dateRange.from || dateRange.to) && (
                      <button onClick={() => setDateRange({ from: "", to: "" })}
                        className="flex items-center gap-1 text-[9px] font-black text-rose-500 hover:text-rose-600">
                        <X size={10}/> مسح الفترة
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* الأعمدة */}
              <div className={clsx("p-4 rounded-2xl border shadow-sm space-y-2", T.card)}>
                <h3 className="text-[10px] font-black flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-slate-800">
                  <Columns size={13} className={`text-${accentColor}-500`}/> الأعمدة المعروضة
                </h3>
                <div className="space-y-1.5 pt-1">
                  {activeConfig.fields.map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleField(f.key)}
                        className={`accent-${accentColor}-600 w-3.5 h-3.5`}/>
                      <span className={clsx("text-[10px] font-bold transition-colors", selectedFields.includes(f.key) ? "text-slate-700 dark:text-slate-300" : "text-slate-400")}>
                        {f.label}
                        {f.isCurrency && <span className="text-emerald-500 mr-1 text-[8px]">ج.م</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── منطقة التقرير ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* بطاقات الملخص */}
          {summary.currencyFields.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className={clsx("flex items-center gap-2 p-3 rounded-xl border shadow-sm", T.card)}>
                <div className={clsx("p-2 rounded-lg", `bg-${accentColor}-500/10`)}>
                  <Filter size={14} className={`text-${accentColor}-500`}/>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500">إجمالي السجلات</p>
                  <p className={clsx("text-xl font-black", `text-${accentColor}-600 dark:text-${accentColor}-400`)}>{summary.count}</p>
                </div>
              </div>
              {summary.currencyFields.map(f => (
                <div key={f.key} className={clsx("flex items-center gap-2 p-3 rounded-xl border shadow-sm", T.card)}>
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <DollarSign size={14} className="text-emerald-500"/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-500 truncate">{f.label}</p>
                    <p className="text-base font-black text-emerald-600">
                      {(summary.totals[f.key] || 0).toLocaleString()} <span className="text-[9px]">ج.م</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* شريط الإجراءات */}
          <div className={clsx("p-3 rounded-2xl border shadow-sm flex flex-wrap justify-between items-center gap-3", T.card)}>
            <div className="flex items-center gap-2">
              <span className={clsx(
                "text-[10px] font-black px-3 py-1.5 rounded-lg border",
                `bg-${accentColor}-50 text-${accentColor}-700 border-${accentColor}-200`,
                "dark:bg-opacity-20 dark:text-opacity-90"
              )}>
                {filteredData.length} سجل
              </span>
              {filteredData.length > 50 && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                  معاينة أول 50 — الطباعة/التصدير: كاملة
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={exportToExcel} disabled={filteredData.length === 0}
                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl font-black text-[10px] flex items-center gap-1.5 border border-emerald-200 transition-all active:scale-95 disabled:opacity-50 h-[36px]">
                <Download size={13}/> Excel
              </button>
              <button onClick={() => printReport(filteredData, activeConfig, selectedFields)} disabled={filteredData.length === 0}
                className={clsx(
                  "px-5 py-2 text-white rounded-xl font-black text-[10px] shadow-md active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 h-[36px]",
                  `bg-${accentColor}-600 hover:bg-${accentColor}-700`
                )}>
                <Printer size={13}/> طباعة التقرير
              </button>
            </div>
          </div>

          {/* الجدول */}
          <div className={clsx("flex-1 rounded-2xl border shadow-sm overflow-hidden", T.card)}>
            {/* تلميح موبايل */}
            <div className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100">
              <span className="text-[9px] font-bold text-amber-600">← اسحب يساراً للمزيد</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
                <RefreshCw size={28} className={clsx("animate-spin", `text-${accentColor}-400`)}/>
                <p className="text-xs font-black">جاري تجميع البيانات...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-slate-400 m-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                <Filter size={36} className="mb-3 opacity-30"/>
                <p className="text-sm font-black">لا توجد بيانات</p>
                <p className="text-[10px] font-bold mt-1 opacity-70">جرّب تغيير النطاق الزمني أو المصدر</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs min-w-[500px]">
                  <thead className={clsx("border-b", `bg-${accentColor}-900 dark:bg-${accentColor}-950`)}>
                    <tr>
                      <th className="p-3 font-black text-white w-10 text-center">#</th>
                      {activeConfig.fields.filter(f => selectedFields.includes(f.key)).map(f => (
                        <th key={f.key} className="p-3 font-black text-white whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i} className={clsx("hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors", i % 2 !== 0 && "bg-slate-50/40 dark:bg-slate-900/10")}>
                        <td className="p-3 font-bold text-slate-400 text-center">{i + 1}</td>
                        {activeConfig.fields.filter(f => selectedFields.includes(f.key)).map(f => {
                          let val = row[f.key];
                          if (f.format) val = f.format(val);
                          return (
                            <td key={f.key} className={clsx(
                              "p-3 font-bold whitespace-nowrap max-w-[200px] truncate",
                              f.isCurrency ? "text-emerald-600 font-black" : "text-slate-700 dark:text-slate-300"
                            )}>
                              {f.isCurrency ? `${Number(val || 0).toLocaleString()} ج.م` : (val ?? "—")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {/* صف الإجماليات في الجدول */}
                  {summary.currencyFields.length > 0 && (
                    <tfoot>
                      <tr className={clsx("font-black border-t-2", `border-${accentColor}-900 bg-${accentColor}-50 dark:bg-${accentColor}-900/10`)}>
                        <td className="p-3 text-right text-[10px] font-black text-slate-600 dark:text-slate-400"
                          colSpan={selectedFields.length - summary.currencyFields.filter(f => selectedFields.includes(f.key)).length + 1}>
                          الإجمالي:
                        </td>
                        {activeConfig.fields.filter(f => f.isCurrency && selectedFields.includes(f.key)).map(f => (
                          <td key={f.key} className="p-3 text-emerald-700 font-black whitespace-nowrap">
                            {(summary.totals[f.key] || 0).toLocaleString()} ج.م
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
                {filteredData.length > 50 && (
                  <div className="p-2.5 text-center text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-t">
                    معاينة أول 50 سجل — الطباعة/التصدير يشمل جميع السجلات ({filteredData.length})
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportBuilder() {
  return (
    <ErrorBoundary>
      <ReportBuilderInner/>
    </ErrorBoundary>
  );
}

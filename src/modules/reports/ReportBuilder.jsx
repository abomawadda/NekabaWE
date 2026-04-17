import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import BrandHeader from "../../ui/BrandHeader";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Calendar,
  Columns,
  Download,
  FileText,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Search,
  TableProperties,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { REPORT_GROUPS, REPORT_MODULES } from "./reportModules";
import { formatDisplayValue, getDateRange, getTodayISO, normalizeText, toNumber } from "./reportUtils";
import { renderPrintReport } from "./reportPrint";

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center p-20 gap-3 text-rose-500">
          <AlertTriangle size={36} />
          <p className="font-black text-sm">حدث خطأ في شاشة التقارير</p>
          <p className="text-[10px] font-bold opacity-70">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl font-black text-xs"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function ReportBuilderInner() {
  const T = useT();
  const [selectedModule, setSelectedModule] = useState("treasury_ledger");
  const [selectedFields, setSelectedFields] = useState([]);
  const [sourceData, setSourceData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const activeConfig = REPORT_MODULES[selectedModule];

  useEffect(() => {
    setSelectedFields(activeConfig.fields.map((field) => field.key));
    setSearchQ("");
    setDateRange({ from: "", to: "" });
  }, [selectedModule, activeConfig.fields]);

  useEffect(() => {
    setLoading(true);
    setSourceData({});

    const sourceNames = activeConfig.sources || [];
    if (sourceNames.length === 0) {
      setLoading(false);
      return undefined;
    }

    const firstLoadState = new Set(sourceNames);
    const markReady = (sourceName) => {
      firstLoadState.delete(sourceName);
      if (firstLoadState.size === 0) setLoading(false);
    };

    const unsubscribers = sourceNames.map((sourceName) => {
      try {
        return onSnapshot(
          query(collection(db, sourceName)),
          (snapshot) => {
            setSourceData((prev) => ({
              ...prev,
              [sourceName]: snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
            }));
            markReady(sourceName);
          },
          (error) => {
            console.error(`${sourceName}:`, error);
            setSourceData((prev) => ({ ...prev, [sourceName]: [] }));
            markReady(sourceName);
          }
        );
      } catch (error) {
        console.error(`${sourceName}:`, error);
        setSourceData((prev) => ({ ...prev, [sourceName]: [] }));
        markReady(sourceName);
        return () => {};
      }
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
  }, [activeConfig]);

  const rawRows = useMemo(() => activeConfig.buildRows(sourceData), [activeConfig, sourceData]);

  const filteredRows = useMemo(() => {
    let rows = [...rawRows];

    if (activeConfig.dateField && dateRange.from) {
      rows = rows.filter((row) => String(row[activeConfig.dateField] || "").slice(0, 10) >= dateRange.from);
    }
    if (activeConfig.dateField && dateRange.to) {
      rows = rows.filter((row) => String(row[activeConfig.dateField] || "").slice(0, 10) <= dateRange.to);
    }
    if (searchQ.trim()) {
      const normalizedQuery = normalizeText(searchQ);
      rows = rows.filter((row) => normalizeText(row.__search || Object.values(row).join(" ")).includes(normalizedQuery));
    }

    return activeConfig.sortRows(rows);
  }, [activeConfig, dateRange.from, dateRange.to, rawRows, searchQ]);

  const period = useMemo(
    () => getDateRange(filteredRows, activeConfig.dateField),
    [activeConfig.dateField, filteredRows]
  );

  const summary = useMemo(() => {
    const currencyFields = activeConfig.fields.filter((field) => field.currency);
    const totals = currencyFields.reduce((acc, field) => {
      acc[field.key] = filteredRows.reduce((sum, row) => sum + toNumber(row[field.key]), 0);
      return acc;
    }, {});

    return {
      count: filteredRows.length,
      currencyFields,
      totals,
    };
  }, [activeConfig.fields, filteredRows]);

  const previewRows = useMemo(() => filteredRows.slice(0, 80), [filteredRows]);

  const toggleField = (key) => {
    setSelectedFields((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((fieldKey) => fieldKey !== key)
          : prev
        : [...prev, key]
    );
  };

  const exportToExcel = () => {
    const fields = activeConfig.fields.filter((field) => selectedFields.includes(field.key));
    const rows = filteredRows.map((row, index) => {
      const exportedRow = { "#": index + 1 };
      fields.forEach((field) => {
        exportedRow[field.label] = formatDisplayValue(field, row[field.key]);
      });
      return exportedRow;
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 6 }, ...fields.map(() => ({ wch: 22 }))];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, activeConfig.title.slice(0, 28));
    XLSX.writeFile(
      book,
      `${activeConfig.id}_${period.from || "all"}_${period.to || getTodayISO()}.xlsx`
    );
  };

  const activeFields = activeConfig.fields.filter((field) => selectedFields.includes(field.key));
  const ModuleIcon = activeConfig.icon || TableProperties;

  return (
    <div className={clsx("max-w-7xl mx-auto space-y-4 pb-20", T.text)} dir="rtl">
      <BrandHeader sectionTitle="مركز التقارير المخصصة" sectionHint="تجميع وطباعة وتحليل شامل لكل وحدات المنظومة" />

      <div className={clsx("rounded-[2rem] border shadow-sm overflow-hidden", T.card)}>
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-l border-slate-100 dark:border-slate-800 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="rounded-2xl border border-teal-100 dark:border-teal-900/40 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600">
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">وحدات التقارير</h2>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    تم توحيد الفرز والطباعة على A4 لكل تقرير داخل هذه الشاشة.
                  </p>
                </div>
              </div>
            </div>

            {REPORT_GROUPS.map((group) => (
              <div key={group.id} className={clsx("rounded-2xl border p-3 shadow-sm", T.card)}>
                <div className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">
                  {group.label}
                </div>
                <div className="space-y-2">
                  {group.moduleIds.map((moduleId) => {
                    const moduleConfig = REPORT_MODULES[moduleId];
                    const Icon = moduleConfig.icon || TableProperties;
                    const isActive = selectedModule === moduleId;
                    return (
                      <button
                        key={moduleId}
                        onClick={() => setSelectedModule(moduleId)}
                        className={clsx(
                          "w-full text-right px-3 py-3 rounded-xl border transition-all flex items-start gap-3",
                          isActive
                            ? "bg-teal-500/10 border-teal-400 text-teal-700 dark:text-teal-300"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-300"
                        )}
                      >
                        <div className={clsx("p-2 rounded-xl shrink-0", isActive ? "bg-teal-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-black">{moduleConfig.title}</div>
                          <div className="text-[10px] font-bold opacity-75 mt-1 line-clamp-2">
                            {moduleConfig.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className={clsx("rounded-2xl border p-3 shadow-sm", T.card)}>
              <div className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">
                الأعمدة الظاهرة
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeConfig.fields.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                      className="accent-teal-600 w-4 h-4"
                    />
                    <span className={selectedFields.includes(field.key) ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>
                      {field.label}
                      {field.currency ? <span className="text-emerald-500 mr-1">قيمة</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          <section className="p-4 md:p-5 space-y-4">
            <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(255,255,255,0.92))] dark:bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.14),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.75),rgba(15,23,42,0.92))]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/50 text-teal-600 shadow-sm">
                      <ModuleIcon size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[10px] font-black border border-teal-200 dark:border-teal-800/50">
                          شاشة التقارير
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[10px] font-black border border-slate-200 dark:border-slate-700">
                          A4 {activeConfig.orientation === "portrait" ? "عمودي" : "أفقي"}
                        </span>
                      </div>
                      <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">
                        {activeConfig.title}
                      </h1>
                      <p className="text-[11px] md:text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
                        {activeConfig.subtitle}
                      </p>
                      <p className="text-[10px] font-black text-teal-700 dark:text-teal-300 mt-3">
                        ترتيب الفرز المعتمد: {activeConfig.sortLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={exportToExcel}
                      disabled={filteredRows.length === 0}
                      className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl font-black text-[11px] flex items-center gap-2 border border-emerald-200 disabled:opacity-50"
                    >
                      <Download size={14} />
                      Excel
                    </button>
                    <button
                      onClick={() =>
                        renderPrintReport({
                          config: activeConfig,
                          rows: filteredRows,
                          selectedFields,
                          period,
                          summary,
                        })
                      }
                      disabled={filteredRows.length === 0}
                      className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-[11px] flex items-center gap-2 disabled:opacity-50"
                    >
                      <Printer size={14} />
                      طباعة التقرير
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className={clsx("rounded-2xl border p-4 shadow-sm", T.card)}>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black mb-2">
                  <TableProperties size={14} />
                  السجلات المطابقة
                </div>
                <div className="text-3xl font-black text-teal-600">{summary.count}</div>
              </div>
              <div className={clsx("rounded-2xl border p-4 shadow-sm", T.card)}>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black mb-2">
                  <Calendar size={14} />
                  الفترة الفعلية
                </div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-100 leading-6">
                  {period.from || "—"}<br />{period.to || "—"}
                </div>
              </div>
              <div className={clsx("rounded-2xl border p-4 shadow-sm", T.card)}>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black mb-2">
                  <Columns size={14} />
                  الأعمدة النشطة
                </div>
                <div className="text-3xl font-black text-sky-600">{activeFields.length}</div>
              </div>
              <div className={clsx("rounded-2xl border p-4 shadow-sm", T.card)}>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black mb-2">
                  <Filter size={14} />
                  الترتيب المعتمد
                </div>
                <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 leading-5">
                  {activeConfig.sortLabel}
                </div>
              </div>
            </div>

            {summary.currencyFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {summary.currencyFields.map((field) => (
                  <div key={field.key} className={clsx("rounded-2xl border p-4 shadow-sm", T.card)}>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black mb-2">
                      <Wallet size={14} />
                      {field.label}
                    </div>
                    <div className="text-xl font-black text-emerald-600">
                      {formatDisplayValue(field, summary.totals[field.key] || 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={clsx("rounded-2xl border shadow-sm p-4 space-y-3", T.card)}>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">
                    البحث داخل التقرير
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQ}
                      onChange={(event) => setSearchQ(event.target.value)}
                      placeholder={activeConfig.searchPlaceholder}
                      className={clsx("w-full pr-10 pl-4 py-2.5 rounded-xl border text-[11px] font-bold outline-none focus:ring-2 focus:ring-teal-500", T.inp)}
                    />
                  </div>
                </div>

                {activeConfig.dateField ? (
                  <>
                    <div className="w-full xl:w-44">
                      <ArabicDatePicker
                        label="من تاريخ"
                        value={dateRange.from}
                        onChange={(value) => setDateRange((prev) => ({ ...prev, from: value }))}
                        maxVal={dateRange.to || undefined}
                      />
                    </div>
                    <div className="w-full xl:w-44">
                      <ArabicDatePicker
                        label="إلى تاريخ"
                        value={dateRange.to}
                        onChange={(value) => setDateRange((prev) => ({ ...prev, to: value }))}
                        minVal={dateRange.from || undefined}
                        maxVal={getTodayISO()}
                      />
                    </div>
                  </>
                ) : (
                  <div className="xl:col-span-2 flex items-end">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-[11px] font-black text-slate-500">
                      هذا التقرير لا يعتمد فترة زمنية مباشرة.
                    </div>
                  </div>
                )}
              </div>

              {(searchQ || dateRange.from || dateRange.to) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSearchQ("");
                      setDateRange({ from: "", to: "" });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black"
                  >
                    مسح الفلاتر
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    تم تطبيق فلاتر على بيانات التقرير الحالية.
                  </span>
                </div>
              )}
            </div>

            <div className={clsx("rounded-2xl border shadow-sm overflow-hidden", T.card)}>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-teal-600" />
                  <span className="text-[11px] font-black">
                    معاينة التقرير ({filteredRows.length})
                  </span>
                </div>
                {filteredRows.length > previewRows.length && (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                    المعاينة تعرض أول {previewRows.length} سجل فقط، والطباعة تشمل الكل
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-3 text-slate-400">
                  <RefreshCw size={30} className="animate-spin text-teal-500" />
                  <p className="font-black text-sm">جاري تحميل بيانات التقرير...</p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 gap-3 text-slate-400">
                  <FileText size={32} className="opacity-30" />
                  <p className="font-black text-sm">{activeConfig.emptyMessage}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[11px] min-w-[820px]">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="p-3 w-12 text-center font-black">#</th>
                        {activeFields.map((field) => (
                          <th key={field.key} className="p-3 font-black whitespace-nowrap">
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {previewRows.map((row, index) => (
                        <tr key={row.id || `${selectedModule}-${index}`} className={index % 2 === 0 ? "" : "bg-slate-50/60 dark:bg-slate-900/20"}>
                          <td className="p-3 text-center font-black text-slate-400">{index + 1}</td>
                          {activeFields.map((field) => (
                            <td
                              key={`${row.id || index}-${field.key}`}
                              className={clsx(
                                "p-3 font-bold whitespace-nowrap max-w-[280px] truncate",
                                field.currency
                                  ? "text-emerald-600 font-black text-left"
                                  : "text-slate-700 dark:text-slate-200"
                              )}
                              title={formatDisplayValue(field, row[field.key])}
                            >
                              {formatDisplayValue(field, row[field.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {summary.currencyFields.some((field) => selectedFields.includes(field.key)) && (
                      <tfoot>
                        <tr className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700">
                          <td className="p-3 text-center font-black text-slate-500">#</td>
                          {activeFields.map((field, index) => (
                            <td
                              key={`total-${field.key}`}
                              className={clsx(
                                "p-3 font-black",
                                field.currency ? "text-emerald-600 text-left" : "text-slate-500"
                              )}
                            >
                              {index === 0
                                ? "الإجمالي"
                                : field.currency
                                  ? formatDisplayValue(field, summary.totals[field.key] || 0)
                                  : "—"}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ReportBuilder() {
  return (
    <ErrorBoundary>
      <ReportBuilderInner />
    </ErrorBoundary>
  );
}

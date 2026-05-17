import React, { useState, useCallback } from "react";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../../../app/providers/FirebaseProvider";
import { useAuth } from "../../../app/providers/AuthProvider";
import { logAuditEvent } from "../../../utils/auditLog";
import { useT } from "../../../app/providers/ThemeProvider";
import clsx from "clsx";
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle,
  ArrowRight, Loader2, Table2, Settings2, Database,
} from "lucide-react";

const FIELD_MAP = [
  { key: "name", label: "الاسم الكامل", required: true },
  { key: "jobId", label: "الرقم الوظيفي", required: true },
  { key: "nationalId", label: "الرقم القومي", hint: "١٤ رقمًا" },
  { key: "phone", label: "رقم الموبايل" },
  { key: "workplace", label: "جهة العمل" },
  { key: "jobTitle", label: "المسمى الوظيفي" },
  { key: "jobGrade", label: "الدرجة الوظيفية" },
  { key: "hireDate", label: "تاريخ التعيين" },
  { key: "membershipId", label: "رقم العضوية" },
  { key: "membershipStatus", label: "نوع العضوية" },
  { key: "memberState", label: "الحالة" },
  { key: "gender", label: "الجنس" },
  { key: "birthDate", label: "تاريخ الميلاد" },
  { key: "placeOfBirth", label: "محل الميلاد" },
  { key: "qualification", label: "المؤهل" },
  { key: "specialization", label: "التخصص" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "address", label: "العنوان" },
  { key: "governorate", label: "المحافظة" },
  { key: "maritalStatus", label: "الحالة الاجتماعية" },
  { key: "childrenCount", label: "عدد الأبناء" },
  { key: "unionBranch", label: "الفرع النقابي" },
  { key: "unionJoinDate", label: "تاريخ الانضمام للنقابة" },
  { key: "basicSalary", label: "الراتب الأساسي" },
  { key: "allowances", label: "البدلات" },
  { key: "netSalary", label: "صافي الراتب" },
  { key: "bankAccount", label: "الحساب البنكي" },
  { key: "bankName", label: "اسم البنك" },
  { key: "bankBranch", label: "فرع البنك" },
  { key: "insuranceNumber", label: "الرقم التأميني" },
  { key: "bloodType", label: "فصيلة الدم" },
  { key: "specialNeeds", label: "ذوي احتياجات خاصة" },
];

const BATCH_SIZE = 400;

export default function ExcelImporter({ onClose }) {
  const T = useT();
  const { user } = useAuth();
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");

    try {
      const XLSX = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!json.length) {
        setError("الملف لا يحتوي على بيانات");
        return;
      }

      const cols = Object.keys(json[0]);
      setColumns(cols);
      setRawData(json.slice(0, 10));
      setMapping({});

      const autoMap = {};
      cols.forEach((col) => {
        const clean = col.trim();
        const match = FIELD_MAP.find(
          (f) =>
            clean === f.label ||
            clean === f.key ||
            clean.includes(f.label.slice(0, 4))
        );
        if (match) autoMap[col] = match.key;
      });
      setMapping(autoMap);
      setStep("map");
    } catch (err) {
      setError("فشل قراءة الملف: " + (err.message || ""));
    }
  }, []);

  const startImport = useCallback(async () => {
    setImporting(true);
    setResult(null);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const colToField = {};
      columns.forEach((col) => {
        if (mapping[col]) colToField[col] = mapping[col];
      });

      const requiredFields = FIELD_MAP.filter((f) => f.required).map((f) => f.key);
      const success = [];
      const errors = [];
      let batch = writeBatch(db);
      let count = 0;

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const emp = {};

        Object.entries(colToField).forEach(([col, field]) => {
          let val = row[col];
          if (val instanceof Date) {
            val = val.toISOString().slice(0, 10);
          } else if (typeof val === "number" && val > 10000 && colToField[col]?.includes("Date")) {
            const d = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(d)) val = d.toISOString().slice(0, 10);
          }
          emp[field] = val;
        });

        emp.name = String(emp.name || "").trim();
        emp.jobId = String(emp.jobId || "").trim();

        const missing = requiredFields.filter((k) => !emp[k]);
        if (missing.length) {
          errors.push({ row: i + 2, name: emp.name || "—", reason: `الحقول المطلوبة مفقودة: ${missing.join("، ")}` });
          continue;
        }

        const ref = doc(collection(db, "employees"));
        emp.id = ref.id;
        emp.createdAt = serverTimestamp();

        batch.set(ref, emp);
        count++;

        if (count % BATCH_SIZE === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }

        success.push(emp);
        setProgress({ current: success.length, total: allRows.length });
      }

      if (count % BATCH_SIZE !== 0) await batch.commit();

      const batchId = Date.now().toString(36);
      await logAuditEvent("employees.bulk_import", {
        targetId: batchId,
        after: { count: success.length, errors: errors.length },
        riskLevel: "high",
      });

      setResult({ success: success.length, errors, total: allRows.length });
      setStep("result");
    } catch (err) {
      setError("فشل الاستيراد: " + (err.message || ""));
    } finally {
      setImporting(false);
    }
  }, [file, columns, mapping]);

  const autoDetectAll = useCallback(() => {
    const auto = {};
    columns.forEach((col) => {
      const clean = col.trim();
      const match = FIELD_MAP.find(
        (f) =>
          clean === f.label ||
          clean === f.key ||
          clean.includes(f.label.slice(0, 4))
      );
      if (match) auto[col] = match.key;
    });
    setMapping(auto);
  }, [columns]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black/50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && !importing && onClose()}>
      <div className={clsx("w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl", T.card)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-teal-500" />
            <h2 className="font-black text-sm">استيراد أعضاء من Excel</h2>
          </div>
          <button onClick={onClose} disabled={importing} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30">
            <X size={18} />
          </button>
        </div>

        {step === "upload" && (
          <div className="p-6 space-y-5">
            <label className={clsx("flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all", error ? "border-rose-300" : "border-slate-300 dark:border-slate-600")}>
              <Upload size={40} className="text-teal-500 mb-3" />
              <p className="font-black text-sm text-slate-600 dark:text-slate-300">اختر ملف Excel</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">.xlsx أو .xls</p>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/40">
              <p className="font-black text-xs text-sky-700 dark:text-sky-300 mb-2">إرشادات:</p>
              <ul className="text-[10px] font-bold text-sky-600 dark:text-sky-400 space-y-1 pr-4 list-disc">
                <li>يجب أن يحتوي الملف على صف رأس (Header row) بأسماء الحقول</li>
                <li>الحقول الإجبارية: الاسم الكامل، الرقم الوظيفي</li>
                <li>سيتم التعرف على الحقول تلقائيًا ومطابقتها</li>
              </ul>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-black text-xs text-slate-500">
                <Table2 size={14} className="inline ml-1" />
                تم العثور على {rawData.length} صفوف (معاينة)
              </p>
              <div className="flex gap-2">
                <button onClick={autoDetectAll} className="px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600 transition-all flex items-center gap-1">
                  <Settings2 size={12} /> كشف تلقائي
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="p-2 text-right font-black text-slate-500">عمود Excel</th>
                    <th className="p-2 text-right font-black text-slate-500">عينات</th>
                    <th className="p-2 text-right font-black text-slate-500 w-56">الحقل في النظام</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2 font-bold text-slate-700 dark:text-slate-200">{col}</td>
                      <td className="p-2 text-slate-400 max-w-[200px] truncate">
                        {rawData.slice(0, 3).map((r, i) => (
                          <span key={i} className="ml-2">{String(r[col] || "").slice(0, 30)}{i < 2 ? "،" : ""}</span>
                        ))}
                      </td>
                      <td className="p-2">
                        <select
                          value={mapping[col] || ""}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [col]: e.target.value }))}
                          className="w-full text-[10px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                        >
                          <option value="">— لا تستورد —</option>
                          {FIELD_MAP.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label} {f.required ? "*" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setStep("upload")} className="px-4 py-2 rounded-xl text-[10px] font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-all flex items-center gap-1">
                <ArrowRight size={13} /> رجوع
              </button>
              <button
                onClick={startImport}
                disabled={importing}
                className="px-6 py-2.5 rounded-xl text-[11px] font-black bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {importing ? "جاري الاستيراد..." : "بدء الاستيراد"}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40">
              <CheckCircle2 size={28} className="text-teal-600 shrink-0" />
              <div>
                <p className="font-black text-sm text-teal-800 dark:text-teal-200">تم الاستيراد بنجاح</p>
                <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                  {result.success} من أصل {result.total} عضو
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="font-black text-xs text-rose-600 mb-2 flex items-center gap-1">
                  <AlertCircle size={13} /> {result.errors.length} سجلات لم تستورد
                </p>
                <div className="overflow-x-auto rounded-2xl border border-rose-200">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-rose-50 dark:bg-rose-900/20">
                        <th className="p-2 text-right font-black text-rose-600">الصف</th>
                        <th className="p-2 text-right font-black text-rose-600">الاسم</th>
                        <th className="p-2 text-right font-black text-rose-600">السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t border-rose-100 dark:border-rose-800/30">
                          <td className="p-2 font-bold text-rose-700">{e.row}</td>
                          <td className="p-2 text-rose-700">{e.name}</td>
                          <td className="p-2 text-rose-500">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={onClose} className="px-5 py-2 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-slate-800 transition-all">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

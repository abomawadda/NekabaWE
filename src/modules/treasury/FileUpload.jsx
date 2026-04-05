import React, { useRef } from "react";
import { Upload, X, FileText, Paperclip, Download } from "lucide-react";
import { useT } from "../../app/providers/ThemeProvider";
import clsx from "clsx";

export default function FileUpload({ existingFiles = [], onChange }) {
  const T = useT();
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // 🎯 تحويل الملفات فوراً لبيانات قابلة للحفظ والتحميل
    const promises = files.map(f => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            id: Date.now() + Math.random(),
            name: f.name,
            size: f.size > 1024 * 1024 ? (f.size / 1024 / 1024).toFixed(1) + " MB" : (f.size / 1024).toFixed(0) + " KB",
            type: f.type,
            uploadedAt: new Date().toISOString().split('T')[0],
            url: event.target.result
          });
        };
        reader.readAsDataURL(f);
      });
    });

    const newDocs = await Promise.all(promises);
    onChange([...existingFiles, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (id) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المرفق؟")) return;
    onChange(existingFiles.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
         <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Paperclip size={12}/> المرفقات والوثائق</label>
         <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 px-4 py-2 rounded-lg flex items-center gap-1 transition-colors">
           <Upload size={12}/> رفع ملف جديد
         </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {existingFiles.map((file, i) => (
          <div key={file.id || i} className={clsx("flex items-center justify-between p-2.5 rounded-xl border group hover:border-teal-500 transition-colors", T.sxn)}>
            {/* 🎯 رابط تحميل وعرض المرفق */}
            <a href={file.url} download={file.name} className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" title="انقر لتحميل أو عرض المرفق">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-black truncate text-slate-700 dark:text-slate-200">{file.name}</p>
                <p className="text-[8px] font-bold text-slate-400 mt-0.5">{file.size} • {file.uploadedAt}</p>
              </div>
            </a>
            <button type="button" onClick={() => handleDelete(file.id)} className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-1">
              <X size={12}/>
            </button>
          </div>
        ))}
      </div>
      
      {existingFiles.length === 0 && (
        <div className="p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 gap-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <FileText size={24} className="opacity-30"/>
          <p className="text-[10px] font-bold">لا توجد مرفقات، استخدم الزر لإضافة المستندات المؤيدة</p>
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={handleUpload} multiple className="hidden" />
    </div>
  );
}
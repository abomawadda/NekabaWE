import React, { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, doc, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";

// 🎯 استيراد المكونات العالمية
import { useEmployeeModal } from "../../app/providers/GlobalEmployeeModal";
import ResponsiveTable from "../../ui/ResponsiveTable"; // 🎯 الأداة الجديدة للجدول المتجاوب

import { 
  UserPlus, Search, Eye, Edit3, Trash2, 
  Users, X, CheckCircle2, AlertCircle, 
  LayoutGrid, List, Heart, ShieldCheck, ChevronRight, 
  Briefcase, Building, Phone, CreditCard, UserCircle, MessageSquare, Hash, Star
} from "lucide-react";
import clsx from "clsx";

import EmployeeForm from "./EmployeeForm";
import EmployeeProfile from "./EmployeeProfile";

export default function EmployeeDashboard() {
  const T = useT();
  const { openEmployeeModal } = useEmployeeModal();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);
  
  const [viewMode, setViewMode] = useState("list"); 
  const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'view'
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empToDelete, setEmpToDelete] = useState(null); 

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "employees")), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name?.includes(searchTerm) || 
      emp.jobId?.toString().includes(searchTerm) ||
      emp.nationalId?.includes(searchTerm)
    );
  }, [employees, searchTerm]);

  const stats = {
    total: employees.length,
    males: employees.filter(e => e.gender !== 'أنثى').length, 
    females: employees.filter(e => e.gender === 'أنثى').length,
    generalSyndicate: employees.filter(e => e.membershipStatus === 'نقابة عامة').length,
    independentSyndicate: employees.filter(e => e.membershipStatus === 'نقابة مستقلة').length,
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async (data) => {
    try {
      const cleanData = JSON.parse(JSON.stringify(data)); // التنظيف العميق
      const { id, ...dataToSave } = cleanData;

      if (modalMode === 'add') {
        await addDoc(collection(db, "employees"), { ...dataToSave, createdAt: new Date().toISOString() });
        showToast("✅ تم حفظ العضو بنجاح! يمكنك إضافة عضو آخر الآن.");
      } else {
        await setDoc(doc(db, "employees", selectedEmp.id), dataToSave, { merge: true });
        showToast("✅ تم تحديث بيانات العضو بنجاح");
        setModalMode(null); 
      }
    } catch (e) { 
      console.error("Firebase Error:", e);
      showToast(`❌ حدث خطأ: ${e.message}`, "error"); 
    }
  };

  const confirmDelete = async () => {
    if (!empToDelete || !empToDelete.id) return;
    const idToDelete = empToDelete.id;
    setEmployees(prev => prev.filter(e => e.id !== idToDelete));
    setEmpToDelete(null);

    try {
      await deleteDoc(doc(db, "employees", idToDelete));
      showToast("🗑️ تم حذف السجل نهائياً");
    } catch (error) { 
      console.error("Delete Error:", error);
      showToast(`❌ فشل الحذف: ${error.message}`, "error"); 
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-black text-slate-400 animate-pulse text-sm">جاري تحميل سجلات النقابة...</p>
    </div>
  );

  return (
    <div className={clsx("max-w-[1600px] mx-auto animate-in fade-in duration-700", T.text)} dir="rtl">
      
      {/* ── الإشعارات ── */}
      {toast && (
        <div className={clsx("fixed top-10 left-1/2 -translate-x-1/2 z-[5000] px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-white font-bold animate-in slide-in-from-top-10", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
          <span className="text-[11px] leading-tight">{toast.msg}</span>
        </div>
      )}

      {/* ── نافذة تأكيد الحذف ── */}
      {empToDelete && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-sm p-5 rounded-2xl border shadow-2xl text-center space-y-4", T.card)}>
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-1"><Trash2 size={28}/></div>
            <h2 className="text-base font-black">تأكيد حذف العضو</h2>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              هل أنت متأكد من حذف بيانات "<span className="text-rose-600 font-black">{empToDelete.name}</span>" نهائياً؟ <br/> لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-2 pt-3">
              <button onClick={() => setEmpToDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl border text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">إلغاء الأمر</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-[11px] font-black hover:bg-rose-700 shadow-md shadow-rose-600/20 active:scale-95 transition-all">نعم، احذف نهائياً</button>
            </div>
          </div>
        </div>
      )}

      {/* ── الشاشة الرئيسية ── */}
      {!modalMode ? (
        <div className="space-y-4">
          
          {/* الهيدر وزر الإضافة */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div className="space-y-0.5">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <div className="p-2 bg-teal-500/10 rounded-xl text-teal-600"><Users size={24}/></div>
                إدارة أعضاء النقابة
              </h1>
              <p className="text-slate-400 font-bold text-[11px] pr-12">إجمالي المقيدين: {employees.length} عضو</p>
            </div>
            
            <button 
              onClick={() => { setSelectedEmp(null); setModalMode('add'); }}
              className="group bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-black text-[11px] flex items-center gap-2 shadow-lg shadow-teal-600/20 transition-all active:scale-95"
            >
              <UserPlus size={16} className="group-hover:rotate-12 transition-transform"/>
              إضافة عضو جديد
            </button>
          </div>

          {/* الإحصائيات (KPIs) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className={clsx("p-4 rounded-2xl border flex items-center justify-between shadow-sm", T.card)}>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">إجمالي الأعضاء</p><p className="text-2xl font-black">{stats.total}</p></div>
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center"><Users size={20}/></div>
            </div>
            <div className={clsx("p-4 rounded-2xl border flex items-center justify-between shadow-sm", T.card)}>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">ذكور</p><p className="text-2xl font-black">{stats.males}</p></div>
              <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center"><ShieldCheck size={20}/></div>
            </div>
            <div className={clsx("p-4 rounded-2xl border flex items-center justify-between shadow-sm", T.card)}>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">إناث</p><p className="text-2xl font-black">{stats.females}</p></div>
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center"><Heart size={20}/></div>
            </div>
            <div className={clsx("p-4 rounded-2xl border flex items-center justify-between shadow-sm", T.card)}>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">نقابة عامة</p><p className="text-2xl font-black text-teal-600">{stats.generalSyndicate}</p></div>
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center"><Building size={20}/></div>
            </div>
            <div className={clsx("p-4 rounded-2xl border flex items-center justify-between shadow-sm", T.card)}>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">نقابة مستقلة</p><p className="text-2xl font-black text-sky-600">{stats.independentSyndicate}</p></div>
              <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center"><Building size={20}/></div>
            </div>
          </div>

          {/* شريط البحث */}
          <div className={clsx("p-2 rounded-2xl border shadow-sm flex flex-col-reverse md:flex-row items-center gap-2", T.card)}>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto">
              <button onClick={() => setViewMode("list")} className={clsx("flex-1 md:flex-none p-2 rounded-lg transition-all", viewMode === "list" ? "bg-white dark:bg-slate-700 shadow-sm text-teal-600" : "text-slate-400")}><List size={18} className="mx-auto"/></button>
              <button onClick={() => setViewMode("grid")} className={clsx("flex-1 md:flex-none p-2 rounded-lg transition-all", viewMode === "grid" ? "bg-white dark:bg-slate-700 shadow-sm text-teal-600" : "text-slate-400")}><LayoutGrid size={18} className="mx-auto"/></button>
            </div>
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute right-3 top-3 text-slate-400"/>
              <input type="text" placeholder="ابحث بالاسم أو الرقم القومي..." className={clsx("w-full pr-10 pl-4 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-teal-500 transition-all", T.inp)} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          {/* ── منطقة عرض البيانات (شبكة كروت أو جدول متجاوب) ── */}
          {viewMode === "grid" ? (
            
            // وضع الشبكة (Grid View) التقليدي للكمبيوتر والموبايل
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredEmployees.map((emp) => (
                <div key={emp.id} className={clsx("p-4 rounded-2xl border shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-all duration-300", T.card)}>
                  <button 
                    onClick={() => openEmployeeModal(emp)}
                    className="flex flex-col items-center outline-none focus:ring-4 focus:ring-teal-500/20 rounded-2xl p-2 transition-all w-full cursor-pointer"
                    title="عرض البطاقة السريعة"
                  >
                    <div className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center text-2xl font-black mb-2 shadow-sm overflow-hidden border-2 border-teal-100 dark:border-teal-900 group-hover:scale-105 transition-transform">
                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="صورة"/> : emp.name?.[0]}
                    </div>
                    <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 group-hover:text-teal-600 transition-colors">{emp.name}</h3>
                  </button>

                  <p className="text-[11px] font-black text-teal-600 mt-1">{emp.jobTitle || "بدون وظيفة"}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">{emp.workplace || "السنترال غير محدد"}</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 mb-3 tracking-wider">{emp.nationalId || "—"}</p>
                  
                  <div className="flex items-center justify-center gap-1.5 w-full mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setEmpToDelete(emp)} className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all" title="حذف السجل"><Trash2 size={14}/></button>
                    <button onClick={() => { setSelectedEmp(emp); setModalMode('edit'); }} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-all" title="تعديل البيانات"><Edit3 size={14}/></button>
                    <button onClick={() => { setSelectedEmp(emp); setModalMode('view'); }} className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 hover:bg-teal-600 hover:text-white rounded-lg transition-all" title="الملف الشامل"><Eye size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            
            /* 🎯 🎯 🎯 استخدام المكون الذكي ResponsiveTable لوضع الجدول 🎯 🎯 🎯 */
            <ResponsiveTable 
              data={filteredEmployees}
              emptyMessage="لم يتم العثور على أي أعضاء يطابقون بحثك"
              
              // 1. العناوين (تظهر في الكمبيوتر فقط)
              headers={[
                { label: "العضو والوظيفة" },
                { label: "الرقم القومي" },
                { label: "الموبايل" },
                { label: "حالة النقابة", className: "text-center" },
                { label: "إجراءات", className: "text-left" }
              ]}

              // 2. تصميم صف الجدول (يظهر في الكمبيوتر فقط)
              renderDesktopRow={(emp) => (
                <tr className="group hover:bg-teal-500/5 transition-all duration-300">
                  <td className="p-4">
                    <button 
                      onClick={() => openEmployeeModal(emp)}
                      className="flex items-center gap-3 text-right outline-none w-full cursor-pointer group/btn"
                    >
                      <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center font-black text-white text-lg shadow-sm overflow-hidden flex-shrink-0 group-hover/btn:scale-105 transition-transform">
                        {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="صورة"/> : emp.name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate group-hover/btn:text-teal-600 transition-colors">{emp.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-slate-500 truncate flex items-center gap-1"><Briefcase size={10}/> {emp.jobTitle || "—"}</span>
                          <span className="text-[10px] font-bold text-slate-400 truncate hidden sm:flex items-center gap-1 border-r pr-2 border-slate-200 dark:border-slate-700"><Building size={10}/> {emp.workplace || "—"}</span>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <CreditCard size={12} className="text-slate-400"/>
                      {emp.nationalId || "—"}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <Phone size={12} className="text-slate-400"/>
                      {emp.phone ? emp.phone.split('-')[0].trim() : "—"}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black",
                      emp.membershipStatus === "نقابة عامة" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30" :
                      emp.membershipStatus === "نقابة مستقلة" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30" :
                      "bg-slate-100 text-slate-600 dark:bg-slate-800"
                    )}>
                      {emp.membershipStatus || "غير محدد"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1.5 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-all transform xl:translate-x-2 group-hover:translate-x-0">
                      <button onClick={() => { setSelectedEmp(emp); setModalMode('view'); }} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-teal-600 rounded-lg transition-all"><Eye size={16}/></button>
                      <button onClick={() => { setSelectedEmp(emp); setModalMode('edit'); }} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 rounded-lg transition-all"><Edit3 size={16}/></button>
                      <button onClick={() => setEmpToDelete(emp)} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 rounded-lg transition-all"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              )}

              // 3. تصميم الكارت (يظهر في الموبايل والتابلت فقط ويخفي الجدول)
              renderMobileCard={(emp) => (
                <div className={clsx("p-4 rounded-2xl border shadow-sm flex flex-col group", T.card)}>
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-3">
                    <button onClick={() => openEmployeeModal(emp)} className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-lg overflow-hidden shrink-0">
                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover"/> : emp.name?.[0]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{emp.name}</h3>
                      <p className="text-[10px] font-bold text-teal-600 mt-0.5 truncate">{emp.jobTitle || "بدون وظيفة"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-black">الرقم القومي:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{emp.nationalId || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-black">الموبايل:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{emp.phone || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-black">حالة النقابة:</span>
                      <span className={clsx(
                        "px-2 py-0.5 rounded-md font-black text-[9px]",
                        emp.membershipStatus === "نقابة عامة" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30" :
                        emp.membershipStatus === "نقابة مستقلة" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30" :
                        "bg-slate-100 text-slate-600 dark:bg-slate-800"
                      )}>
                        {emp.membershipStatus || "غير محدد"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => { setSelectedEmp(emp); setModalMode('view'); }} className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 text-teal-600 rounded-xl text-[11px] font-black transition-colors hover:bg-teal-50 hover:text-teal-700 flex items-center justify-center gap-1.5"><Eye size={14}/> عرض</button>
                    <button onClick={() => { setSelectedEmp(emp); setModalMode('edit'); }} className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 text-blue-600 rounded-xl text-[11px] font-black transition-colors hover:bg-blue-50 hover:text-blue-700 flex items-center justify-center gap-1.5"><Edit3 size={14}/> تعديل</button>
                    <button onClick={() => setEmpToDelete(emp)} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl text-[11px] font-black transition-colors hover:bg-rose-500 hover:text-white flex items-center justify-center gap-1.5"><Trash2 size={14}/> حذف</button>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      ) : (
        
        /* ── وضع عرض أو تعديل أو إضافة الملف الشامل ── */
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 w-full pb-8">
          <div className={clsx("flex justify-between items-center p-3 md:p-4 rounded-2xl border shadow-sm mb-4", T.card)}>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setModalMode(null)} 
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-all text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1"
              >
                <ChevronRight size={18}/>
                <span className="font-bold text-[11px] hidden md:inline">الرجوع</span>
              </button>
              <div>
                <h2 className="text-base md:text-lg font-black">
                  {modalMode === 'add' ? 'تسجيل بيانات عضو جديد' : modalMode === 'edit' ? 'تحديث السجل الوظيفي' : 'الملف الشخصي الشامل'}
                </h2>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-0.5">
                  إدارة السجلات وبيانات الموارد البشرية بالنقابة
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-6xl mx-auto">
            {modalMode === 'view' ? (
              <EmployeeProfile data={selectedEmp} />
            ) : (
              <div className={clsx("p-3 md:p-4 rounded-2xl border shadow-sm", T.card)}>
                <EmployeeForm 
                  initialData={selectedEmp} 
                  modalMode={modalMode} 
                  onSave={handleSave} 
                  onCancel={() => setModalMode(null)} 
                  employeesDB={employees} 
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
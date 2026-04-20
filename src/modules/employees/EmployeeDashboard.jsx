import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { formatEmployeeDate, getDeathDate, getRetirementDate, isDeceasedMember, isRetiredMember, sortMembersByAgeThenJobId } from "../../utils/memberBenefits";
import { logAuditEvent } from "../../utils/auditLog";
import { filterDataByScope, PERMISSIONS } from "../../security/permissions";

import { 
  UserPlus, Search, Eye, Edit3, Trash2, 
  Users, X, CheckCircle2, AlertCircle, 
  ShieldCheck, Briefcase, Phone, UserCircle, MessageSquare, 
  Cake, GraduationCap, HeartHandshake, Mail, ArrowRight, CalendarClock, 
  PieChart, Award, Activity, Building, Hash, RefreshCw
} from "lucide-react";
import clsx from "clsx";

import EmployeeForm from "./EmployeeForm";
import EmployeeProfile from "./EmployeeProfileFund";

export default function EmployeeDashboard({ forcedEmployeeId = "" } = {}) {
  const T = useT();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const canCreateMember = can(PERMISSIONS.employeesCreate);
  const canEditMember = can(PERMISSIONS.employeesEdit);
  const canDeleteMember = can(PERMISSIONS.employeesDelete);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQ, setSearchQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(10); 

  const [toast, setToast] = useState(null);
  
  const [currentView, setCurrentView] = useState(forcedEmployeeId ? "profile" : "dashboard"); 
  const [selectedEmp, setSelectedEmp] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const unsubEmp = onSnapshot(query(collection(db, "employees")), (snap) => {
      const nextEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(filterDataByScope(nextEmployees, "employees", user));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubEmp();
  }, [user]);

  useEffect(() => {
    if (!forcedEmployeeId || loading) return;
    const normalizedForcedId = String(forcedEmployeeId).trim();
    const matchedEmployee =
      employees.find(
        (employee) =>
          String(employee.id || "").trim() === normalizedForcedId ||
          String(employee.jobId || "").trim() === normalizedForcedId
      ) || null;
    setSelectedEmp(matchedEmployee);
    setCurrentView("profile");
  }, [employees, forcedEmployeeId, loading]);

  const stats = useMemo(() => {
    let totalActiveCount = 0; 
    let generalCount = 0, independentCount = 0;
    let males = 0, females = 0;
    let activeCount = 0, inactiveCount = 0;

    let retiringList = [];
    let deceasedList = [];
    let bDays = { today: [], tomorrow: [], yesterday: [] };
    let anniversaries = [];

    const today = new Date();
    const currentYear = today.getFullYear();
    
    const getDayStr = (offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const todayStr = getDayStr(0);
    const tomorrowStr = getDayStr(1);
    const yesterdayStr = getDayStr(-1);

    const parseDate = (dStr) => {
      if (!dStr) return null;
      const s = String(dStr).trim();
      if (s.includes('-')) {
        const p = s.split('-');
        if (p[0].length === 4) return { y: parseInt(p[0]), m: p[1].padStart(2, '0'), d: p[2].substring(0,2).padStart(2, '0') };
      }
      if (s.includes('/')) {
        const p = s.split('/');
        if (p[2] && p[2].length >= 4) return { y: parseInt(p[2]), m: p[1].padStart(2, '0'), d: p[0].padStart(2, '0') };
      }
      return null;
    };

    employees.forEach(emp => {
      const inactiveStates = ['معاش', 'موقوف', 'استقالة', 'وفاة', 'إجازة'];
      const state = emp.memberState?.trim() || "نشط";
      const retired = isRetiredMember(emp);
      const deceased = isDeceasedMember(emp);
      const isActive = !retired && !deceased && !inactiveStates.some(x => state.includes(x));

      if (isActive) {
        activeCount++;
        totalActiveCount++;
        if (emp.membershipStatus?.includes('مستقل')) independentCount++;
        else generalCount++;
        
        if (emp.gender === 'ذكر') males++;
        else if (emp.gender === 'أنثى') females++;
      } else {
        inactiveCount++;
      }

      const bDateParsed = parseDate(emp.birthDate || emp.dateOfBirth);
      if (bDateParsed) {
        const empBdayStr = `${bDateParsed.d}/${bDateParsed.m}`;
        if (empBdayStr === todayStr) bDays.today.push(emp);
        else if (empBdayStr === tomorrowStr) bDays.tomorrow.push(emp);
        else if (empBdayStr === yesterdayStr) bDays.yesterday.push(emp);

        let retYear;
        let calcRetDate = formatEmployeeDate(getRetirementDate(emp));
        if (calcRetDate) {
          const retParsed = parseDate(calcRetDate);
          if (retParsed) retYear = retParsed.y;
        }
        
        if (retYear === currentYear) {
          const retParsed = parseDate(calcRetDate);
          const retirementMonth = retParsed ? Number(retParsed.m) : null;
          retiringList.push({
            ...emp,
            displayRetDate: calcRetDate,
            retired,
            isCurrentMonthRetirement: retirementMonth === today.getMonth() + 1,
          });
        }
      }

      const deathDate = formatEmployeeDate(getDeathDate(emp));
      const deathParsed = parseDate(deathDate);
      if (deathParsed?.y === currentYear) {
        deceasedList.push({
          ...emp,
          displayDeathDate: deathDate,
          deceased,
          isCurrentMonthDeath: Number(deathParsed.m) === today.getMonth() + 1,
        });
      }

      const hDateParsed = parseDate(emp.hireDate);
      if (hDateParsed) {
        const hireDayStr = `${hDateParsed.d}/${hDateParsed.m}`;
        if (hireDayStr === todayStr && hDateParsed.y < currentYear) {
          const yos = currentYear - hDateParsed.y;
          if (!isNaN(yos)) {
              anniversaries.push({ ...emp, yearsOfService: yos });
          }
        }
      }
    });

    retiringList.sort((a, b) => {
      if (a.isCurrentMonthRetirement !== b.isCurrentMonthRetirement) {
        return a.isCurrentMonthRetirement ? -1 : 1;
      }
      if (a.retired !== b.retired) {
        return a.retired ? -1 : 1;
      }
      const getTimestamp = (dStr) => {
        if (!dStr) return 0;
        const p = dStr.split('/');
        return new Date(p[2], p[1] - 1, p[0]).getTime();
      };
      return getTimestamp(b.displayRetDate) - getTimestamp(a.displayRetDate);
    });

    deceasedList.sort((a, b) => {
      if (a.isCurrentMonthDeath !== b.isCurrentMonthDeath) {
        return a.isCurrentMonthDeath ? -1 : 1;
      }
      const getTimestamp = (dStr) => {
        if (!dStr) return 0;
        const p = dStr.split('/');
        return new Date(p[2], p[1] - 1, p[0]).getTime();
      };
      return getTimestamp(b.displayDeathDate) - getTimestamp(a.displayDeathDate);
    });

    return { 
      totalActiveCount, generalCount, independentCount, 
      males, females, activeCount, inactiveCount,
      retiringList, deceasedList, bDays, anniversaries 
    };
  }, [employees]);

  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return sortMembersByAgeThenJobId(employees.filter((e) => !isRetiredMember(e) && !isDeceasedMember(e)));
    const lowerQ = searchQ.toLowerCase().trim();
    return sortMembersByAgeThenJobId(
      employees.filter(e =>
        (
          e.name?.toLowerCase().includes(lowerQ) ||
          e.jobId?.toString().includes(lowerQ) ||
          e.nationalId?.includes(lowerQ) ||
          e.phone?.includes(lowerQ)
        )
      )
    );
  }, [searchQ, employees]);

  const openAddForm = () => {
    if (!canCreateMember) return showToast("ليس لديك صلاحية إضافة أعضاء جدد.", "error");
    setSelectedEmp(null); setCurrentView("form");
  };
  const openEditForm = (emp) => {
    if (!canEditMember) return showToast("ليس لديك صلاحية تعديل بيانات الأعضاء.", "error");
    setSelectedEmp(emp); setCurrentView("form");
  };
  const openProfile = (emp) => { setSelectedEmp(emp); setCurrentView("profile"); };
  const closeToDashboard = () => {
    setSelectedEmp(null);
    if (forcedEmployeeId) {
      navigate("/employees");
      return;
    }
    setCurrentView("dashboard");
  };

  const handleDelete = async (emp) => {
    if (!canDeleteMember) {
      showToast("صلاحية حذف الأعضاء غير متاحة لدورك.", "error");
      return;
    }
    if(window.confirm(`هل أنت متأكد من حذف العضو "${emp.name}" نهائياً من قاعدة البيانات؟`)) {
      try {
        await deleteDoc(doc(db, "employees", emp.id));
        await logAuditEvent("employees.delete", {
          targetId: emp.id,
          before: { name: emp.name, jobId: emp.jobId },
          riskLevel: "high",
        });
        showToast("تم حذف السجل بنجاح", "success");
      } catch (err) {
        showToast("حدث خطأ أثناء الحذف", "error");
      }
    }
  };

  const handleSaveEmp = async (formData) => {
    if ((!selectedEmp && !canCreateMember) || (selectedEmp && !canEditMember)) {
      showToast("ليس لديك صلاحية حفظ هذا التعديل.", "error");
      return;
    }
    try {
      if (currentView === 'form' && !selectedEmp) {
        const newDocRef = doc(collection(db, "employees"));
        await setDoc(newDocRef, { ...formData, id: newDocRef.id, createdAt: serverTimestamp() });
        await logAuditEvent("employees.create", {
          targetId: newDocRef.id,
          after: { name: formData.name, jobId: formData.jobId },
          riskLevel: "medium",
        });
        showToast("تم تسجيل العضو بنجاح!");
      } else {
        await setDoc(doc(db, "employees", formData.id || selectedEmp.id), { ...formData, updatedAt: serverTimestamp() }, { merge: true });
        await logAuditEvent("employees.update", {
          targetId: formData.id || selectedEmp.id,
          after: { name: formData.name, jobId: formData.jobId },
          riskLevel: "medium",
        });
        showToast("تم تحديث السجل بنجاح!");
      }
      closeToDashboard();
    } catch (err) {
      showToast("حدث خطأ أثناء الحفظ", "error");
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <RefreshCw size={32} className="animate-spin text-teal-500"/>
      <p className="font-black text-slate-500">جاري تحميل السجلات...</p>
    </div>
  );

  // 🎯 شاشة فورم الموظف (كاملة)
  if (currentView === "form") {
    return (
      <div className={clsx("max-w-7xl mx-auto space-y-4 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500", T.text)} dir="rtl">
        <div className={clsx("p-4 rounded-2xl border shadow-sm flex items-center justify-between", T.card)}>
          <div className="flex items-center gap-3">
            <button onClick={closeToDashboard} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all">
              <ArrowRight size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h2 className="text-xl font-black">{selectedEmp ? 'تحديث السجل الوظيفي' : 'تسجيل عضو جديد'}</h2>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">إدارة السجلات وبيانات الموارد البشرية بالنقابة</p>
            </div>
          </div>
        </div>
        <div className={clsx("p-2 md:p-6 rounded-3xl border shadow-sm", T.card)}>
          <EmployeeForm 
            initialData={selectedEmp} 
            modalMode={selectedEmp ? "edit" : "add"} 
            onSave={handleSaveEmp} 
            onCancel={closeToDashboard} 
            employeesDB={employees} 
          />
        </div>
      </div>
    );
  }

  // 🎯 شاشة البروفايل (كاملة)
  if (currentView === "profile") {
    const liveSelectedEmp = employees.find((emp) => emp.id === selectedEmp?.id) || selectedEmp;
    if (!liveSelectedEmp) {
      return (
        <div className={clsx("max-w-4xl mx-auto space-y-4 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500", T.text)} dir="rtl">
          <div className={clsx("p-4 rounded-2xl border shadow-sm flex items-center justify-between", T.card)}>
            <div className="flex items-center gap-3">
              <button onClick={closeToDashboard} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all">
                <ArrowRight size={20} className="text-slate-600 dark:text-slate-300" />
              </button>
              <div>
                <h2 className="text-xl font-black">الملف الشخصي الشامل</h2>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">تعذر العثور على العضو المطلوب أو ليس ضمن نطاق صلاحياتك.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={clsx("max-w-7xl mx-auto space-y-4 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500", T.text)} dir="rtl">
        <div className={clsx("p-4 rounded-2xl border shadow-sm flex items-center justify-between", T.card)}>
          <div className="flex items-center gap-3">
            <button onClick={closeToDashboard} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all">
              <ArrowRight size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h2 className="text-xl font-black">الملف الشخصي الشامل</h2>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">الرؤية الكاملة لبيانات العضو</p>
            </div>
          </div>
        </div>
        <div className={clsx("p-2 md:p-6 rounded-3xl border shadow-sm", T.card)}>
          <EmployeeProfile data={liveSelectedEmp} />
        </div>
      </div>
    );
  }

  // 🎯 الداش بورد
  return (
    <div className={clsx("max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500", T.text)} dir="rtl">
      
      {toast && (
        <div className={clsx("fixed top-10 left-1/2 -translate-x-1/2 z-[5000] px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-white font-black animate-in fade-in slide-in-from-top-4", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} <span className="text-xs">{toast.msg}</span>
        </div>
      )}

      <div className={clsx("p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center bg-gradient-to-l from-teal-600 to-emerald-700 text-white", T.card)}>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl"><Users size={28} className="text-white"/></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">إدارة شؤون الأعضاء</h1>
            <p className="text-[11px] font-bold text-teal-100 mt-1">لوحة تحكم ذكية للبحث والمتابعة</p>
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <button onClick={openAddForm} className="px-5 py-2.5 bg-white text-teal-700 hover:bg-teal-50 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none">
            <UserPlus size={16}/> تسجيل عضو جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className={clsx("p-4 rounded-2xl border shadow-sm relative overflow-hidden", T.card)}>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl w-fit mb-3"><PieChart size={20}/></div>
          <p className="text-[10px] font-black text-slate-500 uppercase">إجمالي الأعضاء (النشطين)</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">{stats.totalActiveCount.toLocaleString()}</p>
        </div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm relative overflow-hidden", T.card)}>
          <div className="p-3 bg-teal-50 dark:bg-teal-900/30 text-teal-600 rounded-xl w-fit mb-3"><Building size={20}/></div>
          <p className="text-[10px] font-black text-slate-500 uppercase">نقابة عامة / مستقلة</p>
          <p className="text-2xl font-black text-teal-600 mt-1 flex items-baseline gap-1">
            {stats.generalCount.toLocaleString()} <span className="text-[10px] text-slate-400">عامة</span>
          </p>
          <p className="text-xs font-bold text-amber-500 mt-0.5">{stats.independentCount.toLocaleString()} مستقلة</p>
        </div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm relative overflow-hidden", T.card)}>
          <div className="p-3 bg-sky-50 dark:bg-sky-900/30 text-sky-600 rounded-xl w-fit mb-3"><UserCircle size={20}/></div>
          <p className="text-[10px] font-black text-slate-500 uppercase">ذكور / إناث (نشط)</p>
          <p className="text-2xl font-black text-sky-600 mt-1 flex items-baseline gap-1">
            {stats.males.toLocaleString()} <span className="text-[10px] text-slate-400">ذكر</span>
          </p>
          <p className="text-xs font-bold text-pink-500 mt-0.5">{stats.females.toLocaleString()} أنثى</p>
        </div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm relative overflow-hidden", T.card)}>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl w-fit mb-3"><Activity size={20}/></div>
          <p className="text-[10px] font-black text-slate-500 uppercase">نشط / غير نشط (الكل)</p>
          <p className="text-2xl font-black text-emerald-600 mt-1 flex items-baseline gap-1">
            {stats.activeCount.toLocaleString()} <span className="text-[10px] text-slate-400">نشط</span>
          </p>
          <p className="text-xs font-bold text-rose-500 mt-0.5">{stats.inactiveCount.toLocaleString()} موقوف/معاش</p>
        </div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm relative overflow-hidden", T.card)}>
          <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-xl w-fit mb-3"><GraduationCap size={20}/></div>
          <p className="text-[10px] font-black text-slate-500 uppercase">مُحالين للمعاش هذا العام</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{stats.retiringList.length}</p>
        </div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm relative overflow-hidden", T.card)}>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 rounded-xl w-fit mb-3"><AlertCircle size={20}/></div>
          <p className="text-[10px] font-black text-slate-500 uppercase">وفيات هذا العام</p>
          <p className="text-3xl font-black text-slate-700 mt-1">{stats.deceasedList.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-2 mt-2">
        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[250px]", T.card)}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10 flex items-center justify-between">
            <h3 className="font-black text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><Award size={14}/> أعياد التعيين (اليوم)</h3>
            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">{stats.anniversaries.length} عضو</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {stats.anniversaries.length === 0 ? (
              <p className="text-center text-[10px] font-bold text-slate-400 mt-6">لا توجد أعياد تعيين اليوم</p>
            ) : stats.anniversaries.map(emp => (
              <div key={emp.id} className="flex items-center gap-2 p-2 rounded-xl border bg-white dark:bg-slate-900 cursor-pointer hover:border-emerald-200 transition-colors" onClick={() => openProfile(emp)}>
                <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Award size={12}/></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black truncate">{emp.name}</p>
                  <p className="text-[8px] font-bold text-slate-500">أكمل <span className="text-emerald-600 font-black">{emp.yearsOfService}</span> سنة بالخدمة</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[250px]", T.card)}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-900/10 flex items-center justify-between">
            <h3 className="font-black text-[11px] text-sky-700 dark:text-sky-400 flex items-center gap-1.5"><Cake size={14}/> أعياد الميلاد</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
            {['today', 'tomorrow', 'yesterday'].map(dayKey => {
              const dayLabel = dayKey === 'today' ? '🎉 اليوم' : dayKey === 'tomorrow' ? 'غداً' : 'الأمس';
              const list = stats.bDays[dayKey];
              if(list.length === 0) return null;
              return (
                <div key={dayKey} className="space-y-1.5">
                  <h4 className="text-[9px] font-black text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">{dayLabel}</h4>
                  {list.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2 p-1.5 rounded-xl border shadow-sm bg-white dark:bg-slate-900">
                      <div className="min-w-0 flex-1 cursor-pointer pl-1" onClick={() => openProfile(emp)}>
                        <p className="text-[10px] font-black truncate">{emp.name}</p>
                        <p className="text-[8px] font-bold text-slate-500" dir="ltr">{emp.birthDate || emp.dateOfBirth}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {emp.phone && <a href={`https://wa.me/2${emp.phone}`} target="_blank" rel="noreferrer" title="إرسال تهنئة" className="p-1 bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-md transition-colors"><MessageSquare size={12}/></a>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
            {stats.bDays.today.length === 0 && stats.bDays.tomorrow.length === 0 && stats.bDays.yesterday.length === 0 && (
              <p className="text-center text-[10px] font-bold text-slate-400 mt-6">لا توجد أعياد ميلاد قريبة</p>
            )}
          </div>
        </div>

        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[250px]", T.card)}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-900/10 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-black text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-1.5"><CalendarClock size={14}/> إحالات المعاش (العام الحالي)</h3>
              <p className="text-[9px] font-bold text-rose-500">التركيز على الخارجين خلال الشهر الحالي</p>
            </div>
            <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md">{stats.retiringList.length} عضو</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {stats.retiringList.length === 0 ? (
              <p className="text-center text-[10px] font-bold text-slate-400 mt-6">لا يوجد محالين للمعاش</p>
            ) : (
              <table className="w-full text-right whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2 font-black text-[9px] text-slate-500">التاريخ</th>
                    <th className="py-2 px-2 font-black text-[9px] text-slate-500">الاسم والسنترال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.retiringList.map(emp => (
                    <tr key={emp.id} className={clsx("cursor-pointer transition-colors", emp.isCurrentMonthRetirement ? "bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50" : "hover:bg-rose-50/50 dark:hover:bg-rose-900/20")} onClick={() => openProfile(emp)}>
                      <td className="py-1.5 px-2">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={clsx("font-black text-[9px] px-1.5 py-0.5 rounded", emp.isCurrentMonthRetirement ? "text-amber-700 bg-amber-100" : "text-rose-600 bg-rose-50")}>{emp.displayRetDate}</span>
                          {emp.isCurrentMonthRetirement && <span className="text-[8px] font-black text-amber-700">هذا الشهر</span>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <p className={clsx("font-black text-[10px] text-slate-800 dark:text-slate-200 truncate max-w-[130px]", emp.retired && "line-through text-rose-700 dark:text-rose-300")}>{emp.name}</p>
                        <p className="text-[8px] font-bold text-slate-500 truncate max-w-[130px]">{emp.workplace}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[250px]", T.card)}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/70 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-black text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5"><AlertCircle size={14}/> حالات الوفاة (العام الحالي)</h3>
              <p className="text-[9px] font-bold text-slate-500">التركيز على الوفيات خلال الشهر الحالي</p>
            </div>
            <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">{stats.deceasedList.length} عضو</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {stats.deceasedList.length === 0 ? (
              <p className="text-center text-[10px] font-bold text-slate-400 mt-6">لا توجد حالات وفاة مسجلة هذا العام</p>
            ) : (
              <table className="w-full text-right whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2 font-black text-[9px] text-slate-500">التاريخ</th>
                    <th className="py-2 px-2 font-black text-[9px] text-slate-500">الاسم والسنترال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.deceasedList.map(emp => (
                    <tr key={emp.id} className={clsx("cursor-pointer transition-colors", emp.isCurrentMonthDeath ? "bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50" : "hover:bg-slate-50 dark:hover:bg-slate-800/30")} onClick={() => openProfile(emp)}>
                      <td className="py-1.5 px-2">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={clsx("font-black text-[9px] px-1.5 py-0.5 rounded", emp.isCurrentMonthDeath ? "text-amber-700 bg-amber-100" : "text-slate-700 bg-slate-100 dark:bg-slate-700 dark:text-slate-100")}>{emp.displayDeathDate}</span>
                          {emp.isCurrentMonthDeath && <span className="text-[8px] font-black text-amber-700">هذا الشهر</span>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <p className="font-black text-[10px] text-slate-800 dark:text-slate-200 truncate max-w-[130px] line-through opacity-75">{emp.name}</p>
                        <p className="text-[8px] font-bold text-slate-500 truncate max-w-[130px]">{emp.workplace}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      <div className={clsx("p-3 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-3 items-center", T.card)}>
        <div className="relative w-full">
          <Search size={16} className="absolute right-4 top-3 text-slate-400 pointer-events-none"/>
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setVisibleCount(10); }}
            placeholder="بحث سريع بالاسم، الكود، الرقم القومي، الهاتف..."
            className={clsx("w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:border-teal-500 transition-all", T.inp)}/>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <h2 className="text-sm font-black flex items-center gap-2 text-teal-600 dark:text-teal-400">
            <Users size={18}/> دليل الأعضاء <span className="bg-teal-100 text-teal-700 dark:bg-teal-900/50 px-2 py-0.5 rounded-lg text-xs">{searchResults.length}</span>
          </h2>
        </div>

        {searchResults.length === 0 ? (
          <div className={clsx("p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-slate-400", T.card)}>
            <Search size={40} className="opacity-20 mb-3"/>
            <p className="text-sm font-black">لم يتم العثور على أعضاء</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {searchResults.slice(0, visibleCount).map(emp => {
              const retired = isRetiredMember(emp);
              const deceased = isDeceasedMember(emp);
              return (
              <div key={emp.id} className={clsx("p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col justify-between group", T.card, (retired || deceased) && "border-rose-200 bg-rose-50/40 dark:bg-rose-950/10")}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border shadow-sm shrink-0">
                    {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt={emp.name}/> : <UserCircle size={28} className="text-slate-400"/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={clsx("font-black text-sm text-slate-800 dark:text-slate-100 truncate", (retired || deceased) && "line-through text-rose-700 dark:text-rose-300")} title={emp.name}>{emp.name}</p>
                    <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mt-0.5 truncate flex items-center gap-1"><Briefcase size={10}/> {emp.jobTitle}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate flex items-center gap-1"><Building size={10}/> {emp.workplace || "بدون سنترال"}</p>
                    {retired && (
                      <p className="text-[10px] font-black text-rose-600 mt-1">
                        محال للمعاش: {formatEmployeeDate(getRetirementDate(emp)) || "تم تسجيله كمعاش"}
                      </p>
                    )}
                    {deceased && (
                      <p className="text-[10px] font-black text-slate-700 mt-1">
                        وفاة: {formatEmployeeDate(getDeathDate(emp)) || "تم تسجيل الحالة"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="font-black text-slate-600 dark:text-slate-300 flex items-center gap-1"><Hash size={10} className="text-sky-500"/> {emp.jobId || "—"}</div>
                  <div className="font-black text-slate-600 dark:text-slate-300 flex items-center gap-1"><Phone size={10} className="text-emerald-500"/> {emp.phone || "—"}</div>
                  <div className="col-span-2 flex items-center gap-2 mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className={clsx("px-2 py-0.5 rounded-lg text-[9px] font-black shadow-sm", emp.membershipStatus === 'نقابة مستقلة' ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700")}>{emp.membershipStatus || "عضو"}</span>
                    <span className={clsx("px-2 py-0.5 rounded-lg text-[9px] font-black border", emp.memberState === "نشط" && !retired && !deceased ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-rose-200 text-rose-600 bg-rose-50")}>{deceased ? "وفاة" : retired ? "معاش" : (emp.memberState || "نشط")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <button onClick={() => openProfile(emp)} className="flex flex-col items-center justify-center p-2 bg-teal-50 hover:bg-teal-600 text-teal-600 hover:text-white rounded-xl transition-colors group/btn">
                    <Eye size={16} className="mb-1"/> <span className="text-[9px] font-black">عرض الملف</span>
                  </button>
                  <button onClick={() => openEditForm(emp)} className="flex flex-col items-center justify-center p-2 bg-sky-50 hover:bg-sky-600 text-sky-600 hover:text-white rounded-xl transition-colors group/btn">
                    <Edit3 size={16} className="mb-1"/> <span className="text-[9px] font-black">تعديل</span>
                  </button>
                  <button onClick={() => handleDelete(emp)} className="flex flex-col items-center justify-center p-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition-colors group/btn">
                    <Trash2 size={16} className="mb-1"/> <span className="text-[9px] font-black">حذف</span>
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}

        {visibleCount < searchResults.length && (
          <div className="flex justify-center mt-6">
            <button onClick={() => setVisibleCount(v => v + 10)}
              className="px-8 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:text-teal-600 text-slate-500 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95 flex items-center gap-2">
              <RefreshCw size={16}/> تحميل المزيد من الأعضاء ({searchResults.length - visibleCount} متبقي)
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

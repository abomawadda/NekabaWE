import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, X } from "lucide-react"; 
import clsx from "clsx";
import { useT } from "../providers/ThemeProvider";

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const T = useT(); 
  
  // 🎯 حالات القوائم المنسدلة
  const [isTreasuryOpen, setIsTreasuryOpen] = useState(pathname.includes('/treasury'));
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(pathname.includes('/activities'));
  const [isReportsOpen, setIsReportsOpen] = useState(pathname.includes('/reports'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.includes('/importer'));

  // تحديث حالة القوائم بناءً على الرابط الحالي
  useEffect(() => {
    if (pathname.includes('/treasury')) setIsTreasuryOpen(true);
    if (pathname.includes('/activities')) setIsActivitiesOpen(true);
    if (pathname.includes('/reports')) setIsReportsOpen(true);
    if (pathname.includes('/importer')) setIsSettingsOpen(true);
  }, [pathname]);

  // 🎯 القوائم الثابتة (التي لا تحتاج لانسدال)
  const menuGroups = [
    { title: "العامة", links: [{ label: "الرئيسية", path: "/dashboardpage", icon: "🏠" }] },
    { title: "شؤون المجلس", links: [{ label: "مجلس الإدارة", path: "/board", icon: "🛡️" }] }, 
    { title: "شؤون الأعضاء", links: [{ label: "إدارة الأعضاء", path: "/employees", icon: "👥" }] },
  ];

  // 🎯 روابط الأقسام المنسدلة
  const activitiesLinks = [
    { label: "الفعاليات", path: "/activities/master" },
    { label: "الحجز والتذاكر", path: "/activities/bookings" },
  ];

  const treasuryLinks = [
    { label: " إصدار شيك", path: "/treasury/admin" },
    { label: "شيك إعانة", path: "/treasury/admin?type=aid" },
    { label: "شيك سلفة", path: "/treasury/admin?type=advance" },
    { label: "شيك رحلة", path: "/treasury/admin?type=trip" },
    { label: "خصم مباشر", path: "/treasury/admin?type=bank_charge" },
    { label: "تسوية الشيكات", path: "/treasury/settlements" }, 
    { label: "كشف حساب ", path: "/treasury/ledger" }
  ];

  const reportsLinks = [
    { label: "التقارير التنفيذية", path: "/reports?mode=executive" },
    { label: "تقارير مخصصة", path: "/reports" },
  ];

  const settingsLinks = [
    { label: "استيراد البيانات", path: "/importer" },
  ];

  // دالة لإغلاق السايد بار تلقائياً في الموبايل
  const handleLinkClick = () => {
    if (window.innerWidth < 1024) { 
      setIsOpen(false);
    }
  };

  return (
    <aside className={clsx(
      "w-60 h-screen top-0 p-4 shadow-2xl lg:shadow-sm flex flex-col border-l transition-transform duration-300 ease-in-out z-50",
      "fixed lg:sticky lg:translate-x-0",
      isOpen ? "translate-x-0" : "translate-x-full",
      T.nav, T.div
    )}>
      <div className="mb-6 px-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-teal-600 dark:text-teal-400 tracking-tight">النقابة العامة</h1>
          <p className={clsx("text-[10px] font-medium uppercase mt-1", T.muted)}>منظومة الإدارة الذكية</p>
        </div>
        
        <button 
          onClick={() => setIsOpen(false)} 
          className={clsx("lg:hidden p-1.5 rounded-lg transition-colors hover:bg-rose-50 hover:text-rose-500", T.btn)}
        >
          <X size={18}/>
        </button>
      </div>

      <nav className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
        
        {/* ── القوائم الأساسية ── */}
        {menuGroups.map((group) => (
          <div key={group.title}>
            <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest", T.muted)}>{group.title}</h2>
            <div className="space-y-1">
              {group.links.map((l) => {
                const isActive = pathname === l.path && search === "";
                return (
                  <Link key={l.path} to={l.path} onClick={handleLinkClick}
                    className={clsx(
                      "group flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
                      isActive ? (T.dark ? "bg-teal-500/10 text-teal-400 border-teal-500/20 translate-x-1 shadow-md" : "bg-teal-500 text-white border-teal-500 shadow-md translate-x-1") : clsx(T.btn, "border-transparent")
                    )}>
                    <span className={clsx("text-base transition-transform", isActive ? "scale-110" : "group-hover:scale-110")}>{l.icon}</span>
                    {l.label}
                    {isActive && <div className={clsx("mr-auto w-1.5 h-1.5 rounded-full", T.dark ? "bg-teal-400" : "bg-white")}></div>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── 🏕️ قسم الأنشطة ── */}
        <div>
           <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest mt-2", T.muted)}>الخدمات النقابية</h2>
           <div className="space-y-1">
             <button onClick={() => setIsActivitiesOpen(!isActivitiesOpen)}
                className={clsx(
                  "w-full group flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
                  isActivitiesOpen ? (T.dark ? "bg-indigo-900/30 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-200") : clsx(T.btn, "border-transparent")
                )}>
                <div className="flex items-center gap-3"><span className="text-base">🏕️</span> الأنشطة</div>
                {isActivitiesOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
             </button>

             {isActivitiesOpen && (
               <div className="pr-6 pt-1 pb-1 space-y-0.5 border-r-2 border-indigo-100 dark:border-indigo-900 mr-6 mt-1 animate-in fade-in slide-in-from-top-2">
                 {activitiesLinks.map(l => {
                   const isActive = (pathname + search) === l.path;
                   return (
                     <Link key={l.path} to={l.path} onClick={handleLinkClick}
                        className={clsx(
                          "block w-full text-right text-xs font-bold py-2 px-3 rounded-lg transition-all",
                          isActive 
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 translate-x-1" 
                            : "text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}>
                        {isActive && <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full ml-1.5"></span>}
                        {l.label}
                     </Link>
                   )
                 })}
               </div>
             )}
           </div>
        </div>

        {/* ── 💰 قسم الشيكات (الخزينة) ── */}
        <div>
           <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest mt-2", T.muted)}>شؤون الخزينة</h2>
           <div className="space-y-1">
             <button onClick={() => setIsTreasuryOpen(!isTreasuryOpen)}
                className={clsx(
                  "w-full group flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
                  isTreasuryOpen ? (T.dark ? "bg-slate-800/50 text-teal-400 border-slate-700" : "bg-slate-50 text-teal-700 border-slate-200") : clsx(T.btn, "border-transparent")
                )}>
                <div className="flex items-center gap-3"><span className="text-base">💰</span> الماليات </div>
                {isTreasuryOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
             </button>

             {isTreasuryOpen && (
               <div className="pr-6 pt-1 pb-1 space-y-0.5 border-r-2 border-teal-100 dark:border-teal-900 mr-6 mt-1 animate-in fade-in slide-in-from-top-2">
                 {treasuryLinks.map(l => {
                   const isActive = (pathname + search) === l.path || (l.path === "/treasury/admin" && pathname === "/treasury/admin" && search === "");
                   return (
                     <Link key={l.path} to={l.path} onClick={handleLinkClick}
                        className={clsx(
                          "block w-full text-right text-xs font-bold py-2 px-3 rounded-lg transition-all",
                          isActive 
                            ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 translate-x-1" 
                            : "text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}>
                        {isActive && <span className="inline-block w-1.5 h-1.5 bg-teal-500 rounded-full ml-1.5"></span>}
                        {l.label}
                     </Link>
                   )
                 })}
               </div>
             )}
           </div>
        </div>

        {/* ── 📊 قسم التقارير ── */}
        <div>
           <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest mt-2", T.muted)}>التحليل والبيانات</h2>
           <div className="space-y-1">
             <button onClick={() => setIsReportsOpen(!isReportsOpen)}
                className={clsx(
                  "w-full group flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
                  isReportsOpen ? (T.dark ? "bg-amber-900/30 text-amber-400 border-amber-800" : "bg-amber-50 text-amber-700 border-amber-200") : clsx(T.btn, "border-transparent")
                )}>
                <div className="flex items-center gap-3"><span className="text-base">📊</span> التقارير</div>
                {isReportsOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
             </button>

             {isReportsOpen && (
               <div className="pr-6 pt-1 pb-1 space-y-0.5 border-r-2 border-amber-100 dark:border-amber-900 mr-6 mt-1 animate-in fade-in slide-in-from-top-2">
                 {reportsLinks.map(l => {
                   const isActive = (pathname + search) === l.path;
                   return (
                     <Link key={l.path} to={l.path} onClick={handleLinkClick}
                        className={clsx(
                          "block w-full text-right text-xs font-bold py-2 px-3 rounded-lg transition-all",
                          isActive 
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 translate-x-1" 
                            : "text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}>
                        {isActive && <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full ml-1.5"></span>}
                        {l.label}
                     </Link>
                   )
                 })}
               </div>
             )}
           </div>
        </div>

        {/* ── ⚙️ قسم الإعدادات ── */}
        <div>
           <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest mt-2", T.muted)}>إدارة النظام</h2>
           <div className="space-y-1">
             <button onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={clsx(
                  "w-full group flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
                  isSettingsOpen ? (T.dark ? "bg-slate-800/50 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-300") : clsx(T.btn, "border-transparent")
                )}>
                <div className="flex items-center gap-3"><span className="text-base">⚙️</span> الإعدادات</div>
                {isSettingsOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
             </button>

             {isSettingsOpen && (
               <div className="pr-6 pt-1 pb-1 space-y-0.5 border-r-2 border-slate-200 dark:border-slate-700 mr-6 mt-1 animate-in fade-in slide-in-from-top-2">
                 {settingsLinks.map(l => {
                   const isActive = (pathname + search) === l.path;
                   return (
                     <Link key={l.path} to={l.path} onClick={handleLinkClick}
                        className={clsx(
                          "block w-full text-right text-xs font-bold py-2 px-3 rounded-lg transition-all",
                          isActive 
                            ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 translate-x-1" 
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}>
                        {isActive && <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-full ml-1.5"></span>}
                        {l.label}
                     </Link>
                   )
                 })}
               </div>
             )}
           </div>
        </div>

      </nav>
    </aside>
  );
}

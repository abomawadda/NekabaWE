import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import clsx from "clsx";
import { useT } from "../providers/ThemeProvider";
import { useAuth } from "../providers/AuthProvider";

function CollapsibleGroup({
  title,
  icon,
  isOpen,
  setIsOpen,
  links,
  pathname,
  search,
  onLinkClick,
  tone,
  T,
}) {
  if (!links.length) return null;

  return (
    <div>
      <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest mt-2", T.muted)}>
        {title}
      </h2>
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={clsx(
            "w-full group flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
            isOpen
              ? tone
              : clsx(T.btn, "border-transparent")
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">{icon}</span>
            {title}
          </div>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isOpen && (
          <div className="pr-6 pt-1 pb-1 space-y-0.5 border-r-2 border-slate-200 dark:border-slate-800 mr-6 mt-1 animate-in fade-in slide-in-from-top-2">
            {links.map((link) => {
              const isActive = pathname === link.path || (pathname + search) === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={onLinkClick}
                  className={clsx(
                    "block w-full text-right text-xs font-bold py-2 px-3 rounded-lg transition-all",
                    isActive
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 translate-x-1"
                      : "text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                >
                  {isActive && <span className="inline-block w-1.5 h-1.5 bg-teal-500 rounded-full ml-1.5" />}
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const T = useT();
  const { can } = useAuth();

  const [isTreasuryOpen, setIsTreasuryOpen] = useState(pathname.includes("/treasury"));
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(pathname.includes("/activities"));
  const [isReportsOpen, setIsReportsOpen] = useState(pathname.includes("/reports"));
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.includes("/importer") || pathname.includes("/security"));

  useEffect(() => {
    if (pathname.includes("/treasury")) setIsTreasuryOpen(true);
    if (pathname.includes("/activities")) setIsActivitiesOpen(true);
    if (pathname.includes("/reports")) setIsReportsOpen(true);
    if (pathname.includes("/importer") || pathname.includes("/security")) setIsSettingsOpen(true);
  }, [pathname]);

  const menuGroups = useMemo(
    () =>
      [
        can("/dashboardpage")
          ? { title: "العامة", links: [{ label: "الرئيسية", path: "/dashboardpage", icon: "🏠" }] }
          : null,
        can("/board")
          ? { title: "شؤون المجلس", links: [{ label: "مجلس الإدارة", path: "/board", icon: "🛡" }] }
          : null,
        can("/employees")
          ? { title: "شؤون الأعضاء", links: [{ label: "إدارة الأعضاء", path: "/employees", icon: "👥" }] }
          : null,
      ].filter(Boolean),
    [can]
  );

  const activitiesLinks = useMemo(
    () =>
      [
        can("/activities/master") ? { label: "الفعاليات", path: "/activities/master" } : null,
        can("/activities/bookings") ? { label: "الحجز والتذاكر", path: "/activities/bookings" } : null,
      ].filter(Boolean),
    [can]
  );

  const treasuryLinks = useMemo(
    () =>
      [
        can("/treasury/admin") ? { label: "إصدار السندات", path: "/treasury/admin" } : null,
        can("/treasury/admin") ? { label: "شيك إعانة", path: "/treasury/admin?type=aid" } : null,
        can("/treasury/admin") ? { label: "شيك سلفة", path: "/treasury/admin?type=advance" } : null,
        can("/treasury/admin") ? { label: "شيك رحلة", path: "/treasury/admin?type=trip" } : null,
        can("/treasury/admin") ? { label: "خصم مباشر", path: "/treasury/admin?type=bank_charge" } : null,
        can("/treasury/settlements") ? { label: "التسويات", path: "/treasury/settlements" } : null,
        can("/treasury/ledger") ? { label: "كشف الحساب", path: "/treasury/ledger" } : null,
      ].filter(Boolean),
    [can]
  );

  const reportsLinks = useMemo(
    () =>
      [
        can("/reports") ? { label: "التقارير التنفيذية", path: "/reports?mode=executive" } : null,
        can("/reports") ? { label: "تقارير مخصصة", path: "/reports" } : null,
      ].filter(Boolean),
    [can]
  );

  const settingsLinks = useMemo(
    () =>
      [
        can("/importer") ? { label: "استيراد البيانات", path: "/importer" } : null,
        can("/security") ? { label: "مركز الأمان", path: "/security" } : null,
      ].filter(Boolean),
    [can]
  );

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) setIsOpen(false);
  };

  return (
    <aside
      className={clsx(
        "w-60 h-screen top-0 p-4 shadow-2xl lg:shadow-sm flex flex-col border-l transition-transform duration-300 ease-in-out z-50",
        "fixed lg:sticky lg:translate-x-0",
        isOpen ? "translate-x-0" : "translate-x-full",
        T.nav,
        T.div
      )}
    >
      <div className="mb-6 px-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-teal-600 dark:text-teal-400 tracking-tight">النقابة العامة</h1>
          <p className={clsx("text-[10px] font-medium uppercase mt-1", T.muted)}>Secure Operations Console</p>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className={clsx("lg:hidden p-1.5 rounded-lg transition-colors hover:bg-rose-50 hover:text-rose-500", T.btn)}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <h2 className={clsx("px-4 text-[10px] font-bold mb-1.5 uppercase tracking-widest", T.muted)}>
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.links.map((link) => {
                const isActive = pathname === link.path && search === "";
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={handleLinkClick}
                    className={clsx(
                      "group flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border",
                      isActive
                        ? T.dark
                          ? "bg-teal-500/10 text-teal-400 border-teal-500/20 translate-x-1 shadow-md"
                          : "bg-teal-500 text-white border-teal-500 shadow-md translate-x-1"
                        : clsx(T.btn, "border-transparent")
                    )}
                  >
                    <span className={clsx("text-base transition-transform", isActive ? "scale-110" : "group-hover:scale-110")}>
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <CollapsibleGroup
          title="الخدمات النقابية"
          icon="🎟"
          isOpen={isActivitiesOpen}
          setIsOpen={setIsActivitiesOpen}
          links={activitiesLinks}
          pathname={pathname}
          search={search}
          onLinkClick={handleLinkClick}
          tone={T.dark ? "bg-indigo-900/30 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-200"}
          T={T}
        />

        <CollapsibleGroup
          title="الماليات"
          icon="💰"
          isOpen={isTreasuryOpen}
          setIsOpen={setIsTreasuryOpen}
          links={treasuryLinks}
          pathname={pathname}
          search={search}
          onLinkClick={handleLinkClick}
          tone={T.dark ? "bg-slate-800/50 text-teal-400 border-slate-700" : "bg-slate-50 text-teal-700 border-slate-200"}
          T={T}
        />

        <CollapsibleGroup
          title="التقارير"
          icon="📊"
          isOpen={isReportsOpen}
          setIsOpen={setIsReportsOpen}
          links={reportsLinks}
          pathname={pathname}
          search={search}
          onLinkClick={handleLinkClick}
          tone={T.dark ? "bg-amber-900/30 text-amber-400 border-amber-800" : "bg-amber-50 text-amber-700 border-amber-200"}
          T={T}
        />

        <CollapsibleGroup
          title="إدارة النظام"
          icon="⚙"
          isOpen={isSettingsOpen}
          setIsOpen={setIsSettingsOpen}
          links={settingsLinks}
          pathname={pathname}
          search={search}
          onLinkClick={handleLinkClick}
          tone={T.dark ? "bg-slate-800/50 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-300"}
          T={T}
        />
      </nav>
    </aside>
  );
}

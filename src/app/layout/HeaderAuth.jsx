import { AlertTriangle, Bell, Menu, Moon, ShieldCheck, Sun, UserCircle } from "lucide-react";
import { useT, useTh } from "../providers/ThemeProvider";
import { useAuth } from "../providers/AuthProvider";
import clsx from "clsx";

export default function HeaderAuth({ toggleSidebar }) {
  const T = useT();
  const { dark, toggle } = useTh();
  const { user, sessionIntegrity, logout } = useAuth();
  const userSubtitle = user?.membershipStatus || user?.title || "مستخدم النظام";

  return (
    <header className={clsx("h-14 border-b flex items-center justify-between px-4 sm:px-6 transition-colors duration-300 sticky top-0 z-40", T.hdr, T.div)}>
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className={clsx("lg:hidden p-2 rounded-lg transition-colors", T.btn)}>
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h2 className="font-bold text-lg text-teal-600 dark:text-teal-400">لوحة القيادة</h2>
          {sessionIntegrity.hasOtherActiveSessions && (
            <p className="text-[10px] font-black text-amber-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle size={10} />
              توجد جلسات أخرى نشطة لهذا الحساب
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggle}
          title={dark ? "وضع نهاري" : "وضع ليلي"}
          className={clsx("flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-bold transition-all", T.btn)}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          <span className="hidden sm:inline">{dark ? "وضع نهاري" : "وضع ليلي"}</span>
        </button>

        <button className={clsx("relative p-2 rounded-lg border transition-all hidden sm:block", T.btn)}>
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>

        <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-lg border", T.btn)}>
          {user?.profileImage ? (
            <img src={user.profileImage} alt={user.displayName} className="w-8 h-8 rounded-xl object-cover border" />
          ) : (
            <UserCircle size={18} className="text-teal-500" />
          )}
          <div className="hidden md:block">
            <span className={clsx("block text-sm font-semibold", T.text)}>{user?.displayName || "مستخدم"}</span>
            <span className="block text-[10px] font-black text-slate-400">{userSubtitle}</span>
          </div>
        </div>

        <button
          onClick={() => logout({ allDevices: true })}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-black text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 transition-all"
        >
          <ShieldCheck size={14} />
          كل الأجهزة
        </button>

        <button
          onClick={() => logout()}
          className={clsx("px-3 py-1.5 rounded-lg border text-sm font-black transition-all", T.btn)}
        >
          خروج
        </button>
      </div>
    </header>
  );
}

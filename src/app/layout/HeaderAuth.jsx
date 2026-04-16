import { Sun, Moon, Bell, UserCircle, Menu } from "lucide-react";
import { useT, useTh } from "../providers/ThemeProvider";
import { useAuth } from "../providers/AuthProvider";
import clsx from "clsx";

export default function HeaderAuth({ toggleSidebar }) {
  const T = useT();
  const { dark, toggle } = useTh();
  const { user, isReadOnly, logout } = useAuth();

  return (
    <header className={clsx("h-14 border-b flex items-center justify-between px-4 sm:px-6 transition-colors duration-300 sticky top-0 z-40", T.hdr, T.div)}>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className={clsx("lg:hidden p-2 rounded-lg transition-colors", T.btn)}
        >
          <Menu size={20} />
        </button>
        <h2 className="font-bold text-lg text-teal-600 dark:text-teal-400 hidden sm:block">لوحة القيادة</h2>
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
          <UserCircle size={18} className="text-teal-500" />
          <div className="hidden md:block">
            <span className={clsx("block text-sm font-semibold", T.text)}>{user?.displayName || "مستخدم"}</span>
            <span className="block text-[10px] font-black text-slate-400">
              {isReadOnly ? "مشاهدة فقط" : user?.title || "مسؤول النظام"}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className={clsx("px-3 py-1.5 rounded-lg border text-sm font-black transition-all", T.btn)}
        >
          خروج
        </button>
      </div>
    </header>
  );
}

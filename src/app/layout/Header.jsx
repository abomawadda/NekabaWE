import { Sun, Moon, Bell, UserCircle, Menu } from "lucide-react"; // 🎯 أضفنا Menu
import { useT, useTh } from "../providers/ThemeProvider"; 
import clsx from "clsx";

// 🎯 استقبلنا الدالة المسؤولة عن فتح السايد بار
export default function Header({ toggleSidebar }) {
  const T = useT();
  const { dark, toggle } = useTh(); 

  return (
    <header className={clsx("h-14 border-b flex items-center justify-between px-4 sm:px-6 transition-colors duration-300 sticky top-0 z-40", T.hdr, T.div)}>
      
      <div className="flex items-center gap-3">
        {/* 🎯 زر فتح القائمة (يظهر في الموبايل والتابلت فقط lg:hidden) */}
        <button 
          onClick={toggleSidebar}
          className={clsx("lg:hidden p-2 rounded-lg transition-colors", T.btn)}
        >
          <Menu size={20} />
        </button>
        <h2 className={clsx("font-bold text-lg text-teal-600 dark:text-teal-400 hidden sm:block")}>لوحة القيادة</h2>
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
          <span className={clsx("text-sm font-semibold hidden md:block", T.text)}>أ. محمود</span>
        </div>
      </div>
    </header>
  );
}
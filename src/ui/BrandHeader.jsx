import clsx from "clsx";
import { ORG_LEFT_LOGO_URL, ORG_REPORT_SUBTITLE, ORG_REPORT_TITLE, WE_LOGO_URL } from "../utils/branding";

export default function BrandHeader({ sectionTitle = "", sectionHint = "", className = "" }) {
  return (
    <div className={clsx("rounded-3xl border shadow-sm p-4 md:p-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm", className)} dir="rtl">
      <div className="flex items-center gap-3 md:gap-5">
        <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center p-2">
          <img src={WE_LOGO_URL} alt="we-logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-base md:text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">{ORG_REPORT_TITLE}</h1>
          <p className="text-xs md:text-sm font-black text-teal-700 dark:text-teal-300 mt-1">{ORG_REPORT_SUBTITLE}</p>
          {sectionTitle && <p className="text-sm md:text-base font-black text-slate-700 dark:text-slate-200 mt-2">{sectionTitle}</p>}
          {sectionHint && <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-1">{sectionHint}</p>}
        </div>
        <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/40 flex items-center justify-center p-2">
          <img src={ORG_LEFT_LOGO_URL} alt="logo-left" className="w-full h-full object-contain" />
        </div>
      </div>
    </div>
  );
}

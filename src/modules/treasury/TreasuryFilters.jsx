import { Search } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";

export default function TreasuryFilters({ searchQ, setSearchQ, filterType, setFilterType, filterState, setFilterState }) {
  const T = useT();

  return (
    <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="بحث بالمستفيد أو نوع الحركة أو بند الصرف أو رقم الشيك أو المرجع البنكي"
            className={clsx("w-full pr-9 pl-3 py-2.5 rounded-xl border text-xs font-bold", T.inp)}
          />
        </div>

        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={clsx("px-3 py-2.5 rounded-xl border text-xs font-bold", T.sel)}>
          <option value="all">كل الأنواع</option>
          <option value="aid">رعاية</option>
          <option value="budget">ميزانيات</option>
          <option value="activities">أنشطة</option>
          <option value="trip">رحلات</option>
          <option value="event">فاعليات</option>
          <option value="advance">سلفة</option>
          <option value="other">أخرى</option>
          <option value="bank_charge">خصم مباشر</option>
        </select>

        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={clsx("px-3 py-2.5 rounded-xl border text-xs font-bold", T.sel)}>
          <option value="all">كل الحالات</option>
          <option value="posted">مرحل</option>
          <option value="draft">مسودة</option>
          <option value="approved">معتمد</option>
        </select>
      </div>
    </div>
  );
}

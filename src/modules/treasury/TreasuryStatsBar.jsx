import { TrendingDown, TrendingUp, Wallet, RefreshCw, ReceiptText } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";
import { formatMoney } from "../../utils/numberFormat";

const COLOR_STYLES = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function StatCard({ label, value, icon: Icon, color, sub }) { // eslint-disable-line no-unused-vars
  const T = useT();
  return (
    <div className={clsx("flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all", T.card)}>
      <div className={clsx("p-3 rounded-xl shrink-0", COLOR_STYLES[color] || COLOR_STYLES.teal)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className={clsx("text-[10px] font-black uppercase tracking-widest", T.muted)}>{label}</p>
        <p className={clsx("text-lg font-black leading-tight", color === "emerald" ? "text-emerald-600" : color === "rose" ? "text-rose-600" : color === "amber" ? "text-amber-600" : "text-teal-600")}>
          {value}
        </p>
        {sub && <p className={clsx("text-[10px] font-bold mt-0.5", T.muted)}>{sub}</p>}
      </div>
    </div>
  );
}

export default function TreasuryStatsBar({ totalIssued, totalDirectCharges, postedDirectCharges, requiresSettlementCount, openSettlements, settledChecks }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      <StatCard label="إجمالي الشيكات" value={formatMoney(totalIssued)} icon={TrendingDown} color="rose" />
      <StatCard label="خصومات مباشرة" value={formatMoney(totalDirectCharges)} icon={ReceiptText} color="amber" sub={`${postedDirectCharges?.length || 0} حركة مباشرة`} />
      <StatCard label="شيكات تتطلب تسوية" value={`${requiresSettlementCount}`} icon={Wallet} color="teal" />
      <StatCard label="تسويات مفتوحة" value={`${openSettlements}`} icon={RefreshCw} color="amber" sub="سلف ورحلات وفاعليات وشيكات معلّمة للتسوية" />
      <StatCard label="تسويات مغلقة" value={`${settledChecks}`} icon={TrendingUp} color="emerald" />
    </div>
  );
}

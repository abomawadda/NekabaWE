import React from "react";
import {
  Edit2,
  Trash2,
  Paperclip,
  ChevronDown
} from "lucide-react";
import { formatMoney } from "../../utils/numberFormat";
import { getIssuedCheckTypeLabel } from "./helpers/issuedChecks";

export default function TreasuryTable({
  visible,
  paginatedVisible,
  setShowAll,
  canEditFinancial,
  canDeleteFinancial,
  canViewAttachments,
  onEdit,
  onDelete,
  onViewAttachments,
}) {
  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">التاريخ</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">المرجع / الشيك</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">المستفيد</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">النوع</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap w-1/4">البيان</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap text-left">المبلغ</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap text-center">التسوية</th>
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedVisible.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                  لا توجد سجلات مالية مطابقة.
                </td>
              </tr>
            ) : (
              paginatedVisible.map((tx) => {
                const isDeposit = tx.type === "deposit";
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-2 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {tx.date || "—"}
                    </td>
                    <td className="py-2 px-3 text-xs font-medium text-slate-900 whitespace-nowrap">
                      {tx.checkNum || tx.bankReference || "—"}
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-900 whitespace-nowrap">
                      {tx.party || tx.beneficiaryName || "—"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {isDeposit ? "إيداع بنكي" : getIssuedCheckTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-600 truncate max-w-[160px]" title={tx.notes}>
                      {tx.notes || "—"}
                    </td>
                    <td className="py-2 px-3 text-xs font-semibold whitespace-nowrap text-left">
                      <span className={isDeposit ? "text-emerald-600" : "text-slate-900"}>
                        {isDeposit ? "+" : ""}{formatMoney(tx.amount)}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-center">
                      {isDeposit ? (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">مقيد</span>
                      ) : tx.requires_settlement || tx.requiresSettlement ? (
                        tx.isSettled ? (
                          <span className="text-[10px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">مسوى</span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">معلق</span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-left">
                      <div className="flex items-center justify-end gap-2 opacity-60 hover:opacity-100 transition-opacity">
                        {tx.attachments?.length > 0 && canViewAttachments && (
                          <button onClick={() => onViewAttachments(tx.attachments)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <Paperclip size={16} />
                          </button>
                        )}
                        {!isDeposit && canEditFinancial && (
                          <button onClick={() => onEdit(tx)} className="text-slate-400 hover:text-slate-900 transition-colors">
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDeleteFinancial && (
                          <button onClick={() => onDelete(tx)} className="text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {visible.length > paginatedVisible.length && (
        <div className="border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            عرض باقي السجلات ({visible.length - paginatedVisible.length})
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
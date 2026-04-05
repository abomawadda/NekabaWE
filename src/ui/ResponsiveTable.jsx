import React from 'react';
import clsx from 'clsx';
import { useT } from '../app/providers/ThemeProvider'; // تأكد من مسار الثيم

export default function ResponsiveTable({ 
  data, 
  headers, 
  renderDesktopRow, 
  renderMobileCard, 
  emptyMessage = "لا توجد بيانات مسجلة حتى الآن" 
}) {
  const T = useT();

  if (!data || data.length === 0) {
    return (
      <div className={clsx("p-10 flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed mt-4", T.card)}>
        <p className="text-sm font-black text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full mt-4">
      {/* 📱 1. الموبايل والتابلت (شبكة كروت) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
        {data.map((item, index) => (
          <React.Fragment key={item.id || index}>
            {renderMobileCard(item)}
          </React.Fragment>
        ))}
      </div>

      {/* 💻 2. الكمبيوتر (جدول) */}
      <div className={clsx("hidden md:block rounded-2xl border shadow-sm overflow-hidden", T.card)}>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className={clsx("p-4 font-black text-slate-400 text-[11px] uppercase tracking-wider", h.className)}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {data.map((item, index) => (
                <React.Fragment key={item.id || index}>
                  {renderDesktopRow(item)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
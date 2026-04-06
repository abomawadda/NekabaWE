import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WEEK_DAYS_AR = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

const toDateOnly = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatISODate = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const d = toDateOnly(value);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const isBeforeMin = (date, minVal) => {
  if (!minVal) return false;
  const min = toDateOnly(minVal);
  if (!min) return false;
  return date < min;
};

const isAfterMax = (date, maxVal) => {
  if (!maxVal) return false;
  const max = toDateOnly(maxVal);
  if (!max) return false;
  return date > max;
};

const buildMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  // تحويل بداية الأسبوع لتبدأ من السبت
  const firstDayIndex = (firstDay.getDay() + 1) % 7;

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));

  while (days.length % 7 !== 0) days.push(null);
  return days;
};

export default function ArabicDatePicker({
  label,
  value,
  onChange,
  minVal,
  maxVal,
  placeholder = "اختر التاريخ",
  required = false,
  disabled = false,
}) {
  const T = useT();

  const selectedDate = useMemo(() => toDateOnly(value), [value]);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const initialDate = selectedDate || today;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [popupStyle, setPopupStyle] = useState({ top: 0, left: 0, width: 320 });

  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list = [];
    for (let y = currentYear + 5; y >= currentYear - 20; y--) {
      list.push(y);
    }
    return list;
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

  const recalcPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left;
    let top = rect.bottom + 8;

    if (left + width > viewportWidth - 12) {
      left = viewportWidth - width - 12;
    }
    if (left < 12) left = 12;

    const estimatedHeight = 360;
    if (top + estimatedHeight > viewportHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }

    setPopupStyle({
      position: "fixed",
      top,
      left,
      width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    recalcPosition();

    const handleResize = () => recalcPosition();
    const handleScroll = () => recalcPosition();

    const handleClickOutside = (e) => {
      const target = e.target;
      if (
        popupRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const days = useMemo(() => buildMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (date) => {
    if (!date) return;
    if (isBeforeMin(date, minVal) || isAfterMax(date, maxVal)) return;
    onChange?.(formatISODate(date));
    setOpen(false);
  };

  const clearDate = () => {
    onChange?.("");
    setOpen(false);
  };

  const popup = open
    ? createPortal(
        <div
          ref={popupRef}
          style={popupStyle}
          className={clsx(
            "rounded-2xl border shadow-2xl overflow-hidden",
            "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          )}
          dir="rtl"
        >
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goNextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ChevronRight size={16} />
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="h-9 rounded-lg border px-2 text-sm font-black bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                >
                  {MONTHS_AR.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="h-9 rounded-lg border px-2 text-sm font-black bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={goPrevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEK_DAYS_AR.map((day) => (
                <div
                  key={day}
                  className="h-8 flex items-center justify-center text-[11px] font-black text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="h-10" />;
                }

                const selected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                const disabledDay =
                  isBeforeMin(date, minVal) || isAfterMax(date, maxVal);

                return (
                  <button
                    key={formatISODate(date)}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => handleSelectDate(date)}
                    className={clsx(
                      "h-10 rounded-xl text-sm font-black transition border",
                      disabledDay
                        ? "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400"
                        : selected
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : isToday
                        ? "border-teal-300 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30"
                        : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onChange?.(formatISODate(today));
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                setOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              اليوم
            </button>

            <div className="flex items-center gap-2">
              {!!value && (
                <button
                  type="button"
                  onClick={clearDate}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-black border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20 transition"
                >
                  مسح
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="space-y-1 w-full" dir="rtl">
      {label && (
        <label className="text-[10px] font-black text-slate-500 uppercase pr-1 flex items-center gap-1">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={clsx(
          "w-full h-[38px] rounded-xl border text-xs font-bold outline-none transition-all px-3",
          "flex items-center justify-between gap-2",
          disabled
            ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-70 cursor-not-allowed"
            : clsx(T?.inp || "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700", "focus:ring-2 focus:border-teal-500")
        )}
      >
        <span className={clsx(value ? "text-slate-900 dark:text-white" : "text-slate-400")}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar size={14} className="text-slate-400 shrink-0" />
      </button>

      {popup}
    </div>
  );
}

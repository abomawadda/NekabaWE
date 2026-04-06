import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { useT } from "../../app/providers/ThemeProvider";

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
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

  // جعل بداية الأسبوع من السبت
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
  const [popupStyle, setPopupStyle] = useState({
    position: "fixed",
    top: 0,
    left: 0,
    width: 282,
    zIndex: 9999,
  });

  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr = [];
    for (let y = currentYear + 5; y >= currentYear - 20; y--) arr.push(y);
    return arr;
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

  const recalcPosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(282, Math.max(262, rect.width));
    const estimatedHeight = 308;

    let left = rect.left;
    let top = rect.bottom + 8;

    if (left + width > viewportWidth - 12) {
      left = viewportWidth - width - 12;
    }
    if (left < 12) left = 12;

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
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) {
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

  const setToday = () => {
    onChange?.(formatISODate(today));
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
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
            "overflow-hidden rounded-2xl border",
            "bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl",
            "border-slate-200/90 dark:border-slate-700/80",
            "shadow-[0_18px_45px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
          )}
          dir="rtl"
        >
          {/* Header */}
          <div className="relative px-3 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-b from-slate-50/90 to-white dark:from-slate-800/70 dark:to-slate-900">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-teal-500 to-transparent opacity-70" />

            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/25 border border-teal-100 dark:border-teal-800/40">
                  <CalendarDays size={13} className="text-teal-600 dark:text-teal-400" />
                </div>
                <span className="text-[11px] font-black tracking-wide">اختيار التاريخ</span>
              </div>

              {value && (
                <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300">
                  {formatDisplayDate(value)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={goNextMonth}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ChevronRight size={14} className="text-slate-600 dark:text-slate-300" />
              </button>

              <div className="flex items-center gap-1.5">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="h-8 min-w-[98px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {MONTHS_AR.map((month, idx) => (
                    <option key={month} value={idx}>
                      {month}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="h-8 min-w-[74px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={goPrevMonth}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ChevronLeft size={14} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>

          {/* Week Days */}
          <div className="px-2.5 pt-2 pb-1">
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS_AR.map((day) => (
                <div
                  key={day}
                  className="h-6 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Days Grid */}
          <div className="px-2.5 pb-2">
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="h-8" />;
                }

                const selected = isSameDay(date, selectedDate);
                const todayMatch = isSameDay(date, today);
                const disabledDay = isBeforeMin(date, minVal) || isAfterMax(date, maxVal);

                return (
                  <button
                    key={formatISODate(date)}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => handleSelectDate(date)}
                    className={clsx(
                      "relative h-8 rounded-xl text-xs font-black border transition-all duration-200",
                      disabledDay
                        ? "opacity-35 cursor-not-allowed bg-slate-50 dark:bg-slate-900 text-slate-400 border-transparent"
                        : selected
                        ? "bg-gradient-to-b from-teal-500 to-teal-600 text-white border-teal-600 shadow-[0_8px_18px_rgba(13,148,136,0.28)]"
                        : todayMatch
                        ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/30"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {todayMatch && !selected && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
                    )}
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={setToday}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                اليوم
              </button>

              <div className="flex items-center gap-1.5">
                {!!value && (
                  <button
                    type="button"
                    onClick={clearDate}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                  >
                    مسح
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  إغلاق
                </button>
              </div>
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
          "w-full h-[40px] rounded-xl border text-xs font-bold outline-none transition-all px-3",
          "flex items-center justify-between gap-2",
          disabled
            ? "bg-slate-50/60 dark:bg-slate-900/30 opacity-70 cursor-not-allowed"
            : clsx(
                T?.inp || "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700",
                "focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500",
                "hover:border-teal-300 dark:hover:border-teal-700"
              )
        )}
      >
        <span
          className={clsx(
            "truncate",
            value ? "text-slate-900 dark:text-white" : "text-slate-400"
          )}
        >
          {value ? formatDisplayDate(value) : placeholder}
        </span>

        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
          <CalendarDays size={14} className="text-slate-500 dark:text-slate-400" />
        </div>
      </button>

      {popup}
    </div>
  );
}

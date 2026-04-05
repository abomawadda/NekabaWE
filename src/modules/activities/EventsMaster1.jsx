/**
 * EventsMaster — لوحة تحكم وإدارة الفعاليات والأنشطة
 *
 * ✅ حل جذري لمشكلة Array.isArray للمشرفين (توافق مع البيانات القديمة).
 * ✅ إنشاء الفعاليات وتحديد ميزانيتها وسعتها ومواعيد إغلاق الحجز.
 * ✅ تسعير مزدوج (سعر العضو / سعر المرافق).
 * ✅ تنبيهات ذكية (Smart Alerts) للفعاليات القريبة.
 */

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import {
  CalendarDays, Plus, Users, Ticket, CheckCircle2,
  AlertCircle, Clock, MapPin, X, Save, Tent, ShieldAlert, Edit, Trash2, CalendarClock
} from "lucide-react";
import clsx from "clsx";

const EVENT_TYPES = ["رحلة ترفيهية", "رحلة تثقيفية", "حفل إفطار", "مسابقة ثقافية", "مؤتمر/ندوة", "أخرى"];
const BOARD_ROLES = ["رئيس المجلس", "النقيب العام", "الأمين العام", "أمين الصندوق", "عضو مجلس إدارة", "عضو مجلس", "نائب الرئيس"];
const getTodayISO = () => new Date().toISOString().split("T")[0];

function StatCard({ label, value, icon: Icon, color }) {
  const T = useT();
  return (
    <div className={clsx("flex items-center gap-3 p-3 rounded-2xl border shadow-sm transition-all", T.card)}>
      <div className={clsx("p-2.5 rounded-xl shrink-0", `bg-${color}-500/10 text-${color}-600`)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className={clsx("text-[10px] font-black uppercase tracking-widest", T.muted)}>{label}</p>
        <p className={clsx("text-xl font-black leading-none mt-1", `text-${color}-700 dark:text-${color}-400`)}>{Number(value || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}

export default function EventsMaster() {
  const T = useT();
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const [formData, setFormData] = useState({
    title: "", type: EVENT_TYPES[0], date: getTodayISO(), 
    bookingStart: getTodayISO(), bookingEnd: getTodayISO(),
    capacity: "", isFree: false, memberPrice: "", companionPrice: "", supervisors: []
  });

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const qEvents = query(collection(db, "events"), orderBy("date", "asc"));
    const unsubEvents = onSnapshot(qEvents, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qEmps = query(collection(db, "employees"));
    const unsubEmps = onSnapshot(qEmps, snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubEvents(); unsubEmps(); };
  }, []);

  const boardMembers = useMemo(() => employees.filter(e => BOARD_ROLES.includes(e.membershipStatus)), [employees]);

  const stats = useMemo(() => {
    const today = getTodayISO();
    let total = events.length, upcoming = 0, completed = 0, totalBooked = 0;
    events.forEach(e => {
      if (e.date >= today) upcoming++; else completed++;
      totalBooked += Number(e.bookedCount || 0);
    });
    return { total, upcoming, completed, totalBooked };
  }, [events]);

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.capacity) return showToast("برجاء إكمال البيانات الأساسية", "error");
    if (formData.bookingStart > formData.bookingEnd) return showToast("تاريخ بدء الحجز يجب أن يسبق تاريخ الغلق", "error");
    if (formData.bookingEnd > formData.date) return showToast("لا يمكن غلق الحجز بعد تاريخ الفعالية", "error");
    if (!formData.isFree && (!formData.memberPrice || !formData.companionPrice)) return showToast("برجاء تحديد أسعار الاشتراك", "error");

    setSaving(true);
    try {
      const eventData = {
        title: formData.title, type: formData.type, date: formData.date,
        bookingStart: formData.bookingStart, bookingEnd: formData.bookingEnd,
        capacity: Number(formData.capacity),
        isFree: formData.isFree,
        memberPrice: formData.isFree ? 0 : Number(formData.memberPrice),
        companionPrice: formData.isFree ? 0 : Number(formData.companionPrice),
        supervisors: formData.supervisors,
        updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, "events", editId), eventData);
        showToast("تم تحديث الفعالية بنجاح ✓", "success");
      } else {
        await addDoc(collection(db, "events"), { ...eventData, bookedCount: 0, status: "open", createdAt: serverTimestamp() });
        showToast("تم تأسيس الفعالية بنجاح ✓", "success");
      }
      setIsModalOpen(false);
      setEditId(null);
      setFormData({ title: "", type: EVENT_TYPES[0], date: getTodayISO(), bookingStart: getTodayISO(), bookingEnd: getTodayISO(), capacity: "", isFree: false, memberPrice: "", companionPrice: "", supervisors: [] });
    } catch (err) {
      showToast("حدث خطأ أثناء الحفظ", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, title) => {
    if(window.confirm(`هل أنت متأكد من حذف فعالية "${title}" نهائياً؟`)) {
      await deleteDoc(doc(db, "events", id));
      showToast("تم حذف الفعالية", "success");
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400">جاري تحميل دليل الفعاليات...</div>;

  return (
    <div className={clsx("flex flex-col gap-4 max-w-7xl mx-auto pb-10", T.text)} dir="rtl">
      
      {toast && (
        <div className={clsx("fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-white font-bold animate-in fade-in slide-in-from-top-4", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>} <span className="text-xs">{toast.msg}</span>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSaveEvent} className={clsx("w-full max-w-xl p-5 rounded-2xl shadow-2xl border space-y-4 animate-in zoom-in-95", T.card)}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="font-black text-sm flex items-center gap-2 text-indigo-600"><Tent size={18}/> {editId ? "تعديل بيانات الفعالية" : "تأسيس فعالية / نشاط جديد"}</h2>
              <button type="button" onClick={() => {setIsModalOpen(false); setEditId(null);}} className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"><X size={16}/></button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">اسم الفعالية (الوجهة)</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثال: رحلة شرم الشيخ..." className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-indigo-500 h-[38px]", T.inp)} />
              </div>

              <div className="grid grid-cols-2 gap-3 relative z-[100]">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">نوع النشاط</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-indigo-500 h-[38px]", T.sel)}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <ArabicDatePicker label="تاريخ الانطلاق (يوم الفعالية)" value={formData.date} onChange={v => setFormData({...formData, date: v})} minVal={getTodayISO()} />
              </div>

              <div className="grid grid-cols-2 gap-3 relative z-[90] p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <ArabicDatePicker label="يفتح الحجز من" value={formData.bookingStart} onChange={v => setFormData({...formData, bookingStart: v})} />
                <ArabicDatePicker label="يغلق الحجز في" value={formData.bookingEnd} onChange={v => setFormData({...formData, bookingEnd: v})} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">السعة القصوى (أفراد)</label>
                  <input required type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} placeholder="مثال: 50" className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-indigo-500 h-[38px]", T.inp)} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-black">
                    <input type="checkbox" checked={formData.isFree} onChange={e => setFormData({...formData, isFree: e.target.checked})} className="w-4 h-4 accent-indigo-600"/> الفعالية مجانية
                  </label>
                </div>
              </div>

              {!formData.isFree && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">سعر العضو (مدعوم)</label>
                    <input required={!formData.isFree} type="number" min="0" value={formData.memberPrice} onChange={e => setFormData({...formData, memberPrice: e.target.value})} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-black outline-none focus:ring-2 bg-white dark:bg-slate-900", T.inp)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">سعر المرافق</label>
                    <input required={!formData.isFree} type="number" min="0" value={formData.companionPrice} onChange={e => setFormData({...formData, companionPrice: e.target.value})} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-black outline-none focus:ring-2 bg-white dark:bg-slate-900", T.inp)} />
                  </div>
                </div>
              )}

              <div className="space-y-1 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800">
                <label className="text-[10px] font-black text-sky-700 uppercase flex items-center gap-1"><Users size={12}/> هيئة الإشراف (مجلس الإدارة)</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {boardMembers.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-[10px] font-bold cursor-pointer">
                      <input type="checkbox" checked={formData.supervisors.includes(m.name)}
                        onChange={(e) => {
                          if (e.target.checked) setFormData({...formData, supervisors: [...formData.supervisors, m.name]});
                          else setFormData({...formData, supervisors: formData.supervisors.filter(n => n !== m.name)});
                        }} className="accent-sky-600"
                      /> {m.name.split(" ").slice(0,2).join(" ")}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 flex gap-2 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16}/> {editId ? "تحديث التعديلات" : "حفظ واعتماد الفعالية"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── رأس الصفحة ── */}
      <div className={clsx("p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 z-10 relative", T.card)}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400"><Tent size={24} /></div>
          <div><h1 className="text-xl font-black tracking-tight">إدارة الأنشطة والفعاليات</h1><p className={clsx("text-[10px] font-bold mt-0.5", T.muted)}>تأسيس الوجهات وتحديد المواعيد</p></div>
        </div>
        <button onClick={() => { setFormData({ title: "", type: EVENT_TYPES[0], date: getTodayISO(), bookingStart: getTodayISO(), bookingEnd: getTodayISO(), capacity: "", isFree: false, memberPrice: "", companionPrice: "", supervisors: [] }); setEditId(null); setIsModalOpen(true); }} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all flex items-center gap-2">
          <Plus size={16}/> تأسيس فعالية جديدة
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الفعاليات" value={stats.total} icon={CalendarDays} color="slate" />
        <StatCard label="فعاليات قادمة" value={stats.upcoming} icon={Clock} color="indigo" />
        <StatCard label="فعاليات منتهية" value={stats.completed} icon={CheckCircle2} color="emerald" />
        <StatCard label="إجمالي التذاكر المباعة" value={stats.totalBooked} icon={Ticket} color="amber" />
      </div>

      {events.length === 0 ? (
        <div className={clsx("p-20 text-center rounded-3xl border border-dashed opacity-70 bg-slate-50/50 dark:bg-slate-900/20", T.card)}>
          <Tent size={40} className="mx-auto text-slate-300 mb-3"/>
          <p className="text-sm font-black text-slate-500">لا توجد فعاليات مسجلة حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => {
            const isCompleted = event.date < getTodayISO();
            const daysLeft = Math.ceil((new Date(event.date) - new Date(getTodayISO())) / (1000 * 60 * 60 * 24));
            const isNear = !isCompleted && daysLeft <= 3 && daysLeft >= 0;
            const booked = Number(event.bookedCount || 0);
            const capacity = Number(event.capacity || 1);
            const occupancyRate = Math.min(100, (booked / capacity) * 100);
            const today = getTodayISO();
            const isBookingOpen = today >= event.bookingStart && today <= event.bookingEnd && booked < capacity;

            return (
              <div key={event.id} className={clsx("p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md bg-white dark:bg-slate-900 group relative", T.card, isCompleted && "opacity-75 grayscale-[30%]")}>
                
                <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { 
                    // 🎯 تأمين قراءة المشرفين للبيانات القديمة
                    const safeSupervisors = Array.isArray(event.supervisors) ? event.supervisors : (event.supervisors ? [event.supervisors] : []);
                    setFormData({ ...event, supervisors: safeSupervisors }); 
                    setEditId(event.id); 
                    setIsModalOpen(true); 
                  }} className="p-1.5 bg-sky-100 text-sky-600 hover:bg-sky-500 hover:text-white rounded-lg transition-colors"><Edit size={14}/></button>
                  <button onClick={() => handleDelete(event.id, event.title)} className="p-1.5 bg-rose-100 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14}/></button>
                </div>

                <div>
                  <div className="flex justify-between items-start mb-2 pr-12">
                    <span className={clsx("text-[9px] px-2 py-0.5 rounded-md font-black", event.isFree ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700")}>
                      {event.type}
                    </span>
                  </div>
                  <h3 className="font-black text-base truncate pr-1" title={event.title}>{event.title}</h3>
                  
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="flex items-center gap-1"><CalendarClock size={12}/> موعد الانطلاق: {event.date}</span>
                      {!isCompleted ? (
                        <span className={clsx("px-1.5 py-0.5 rounded font-black", isNear ? "bg-rose-100 text-rose-600 animate-pulse" : "text-emerald-600")}>
                          {daysLeft === 0 ? "اليوم" : `باقي ${daysLeft} يوم`}
                        </span>
                      ) : <span className="text-slate-400">انتهت</span>}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 flex items-center justify-between px-1">
                      <span>فترة الحجز: {event.bookingStart || "—"} إلى {event.bookingEnd || "—"}</span>
                      <span className={clsx("w-2 h-2 rounded-full", isBookingOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500")}></span>
                    </div>
                  </div>
                </div>

                <div className="my-3">
                  <div className="flex justify-between text-[10px] font-black mb-1">
                    <span className="text-slate-500 flex items-center gap-1"><Users size={12}/> الإشغال:</span>
                    <span className={booked >= capacity ? "text-rose-600" : "text-teal-600"}>{booked} / {capacity} مقعد</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full transition-all", booked >= capacity ? "bg-rose-500" : "bg-teal-500")} style={{ width: `${occupancyRate}%` }}/>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                  {!event.isFree ? (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">سعر العضو</p><p className="text-xs font-black text-indigo-600">{Number(event.memberPrice).toLocaleString()} ج</p></div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">سعر المرافق</p><p className="text-xs font-black text-slate-700 dark:text-slate-300">{Number(event.companionPrice).toLocaleString()} ج</p></div>
                    </>
                  ) : (<div className="col-span-2 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl text-center text-emerald-600"><p className="text-xs font-black">فعالية مجانية</p></div>)}
                  
                  {/* 🎯 التحقق الآمن للمشرفين عند العرض */}
                  {event.supervisors && event.supervisors.length > 0 && (
                    <div className="col-span-2 text-[9px] font-bold text-sky-600 mt-1 flex items-center gap-1 bg-sky-50 dark:bg-sky-900/20 p-1.5 rounded-lg border border-sky-100 dark:border-sky-800">
                      <ShieldAlert size={12}/> إشراف: <span className="truncate">
                        {Array.isArray(event.supervisors) ? event.supervisors.join(" - ") : event.supervisors}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
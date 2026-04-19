/**
 * EventBookings — محرك الحجز والتذاكر (النسخة المتقدمة - إصلاح الاستيراد)
 *
 * التحسينات المضافة:
 * ✅ إصلاح خطأ UserPlus بإضافة الاستيراد الصحيح.
 * ✅ إدراج بيانات المرافقين تفصيلياً (اسم، صلة، هاتف، رقم قومي).
 * ✅ استخراج تلقائي للبيانات من الرقم القومي.
 * ✅ لوحة إشراف أعضاء المجلس (خصومات ومكافآت).
 */

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, doc, writeBatch, serverTimestamp, orderBy, where } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import { openPrintWindow } from "../../utils/print";
import {
  Ticket, Users, CheckCircle2, AlertCircle, Search, 
  CreditCard, Printer, Copy, X, Banknote, Smartphone, Receipt, ShieldAlert, Trash2, 
  Plus, UserPlus, Award, UserX // 🎯 تم إضافة الاستيرادات الناقصة هنا
} from "lucide-react";
import clsx from "clsx";

const getTodayISO = () => new Date().toISOString().split("T")[0];
const BOARD_ROLES = ["رئيس المجلس", "النقيب العام", "الأمين العام", "أمين الصندوق", "عضو مجلس إدارة", "عضو مجلس", "نائب الرئيس"];

// ── 1. محرك استخراج بيانات الرقم القومي المصري ──
const parseNationalID = (nid) => {
  if (!nid || nid.length !== 14 || isNaN(nid)) return null;
  const century = nid[0] === '2' ? '19' : nid[0] === '3' ? '20' : null;
  if (!century) return null;
  const year = century + nid.slice(1, 3);
  const month = nid.slice(3, 5);
  const day = nid.slice(5, 7);
  const govCode = nid.slice(7, 9);
  const genderCode = parseInt(nid[12]);
  
  const dob = `${year}-${month}-${day}`;
  const gender = genderCode % 2 === 0 ? 'أنثى' : 'ذكر';
  
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

  const GOV_MAP = {
    '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس', '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية', '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة', '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم', '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا', '28': 'أسوان', '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد', '33': 'مطروح', '34': 'شمال سيناء', '35': 'جنوب سيناء', '88': 'خارج الجمهورية'
  };
  const gov = GOV_MAP[govCode] || 'غير معروف';

  return { dob, gender, age, gov };
};

// ── 2. محرك الطباعة الشامل لكشف الحضور ──
const printManifestLocal = (event, bookings) => {
  const win = openPrintWindow("event-manifest-legacy", "width=1000,height=800");
  if (!win) return;
  
  const validBookings = bookings.filter(b => b.status !== "cancelled");
  const totalPax = validBookings.reduce((sum, b) => sum + 1 + (b.companionsList?.length || 0), 0);

  const rowsHtml = validBookings.length > 0 
    ? validBookings.map((b, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>
            <strong>${b.memberName}</strong> <span style="font-size:10px; color:#4f46e5; border:1px solid #4f46e5; border-radius:4px; padding:1px 4px;">عضو</span><br>
            <span style="font-size:10px;color:#64748b;">كود: ${b.memberId} | 📱 ${b.memberPhone || "—"}</span>
            ${b.companionsList?.length > 0 ? `
              <div style="margin-top:5px; font-size:11px; color:#334155; background:#f8fafc; padding:5px; border-radius:4px;">
                <strong>المرافقين (${b.companionsList.length}):</strong><br>
                ${b.companionsList.map(c => `- ${c.name} (${c.relation}) - السن: ${c.parsedInfo?.age || '—'}`).join('<br>')}
              </div>
            ` : ''}
          </td>
          <td style="text-align:center">${b.totalPax} أفراد</td>
          <td style="text-align:center">${Number(b.totalCost).toLocaleString()} ج</td>
          <td style="text-align:center; font-size:10px;">${b.paymentSummary || "مجاني"}</td>
          <td></td>
        </tr>
      `).join("")
    : `<tr><td colspan="6" style="text-align:center; padding:30px;">لا يوجد مشتركون بعد</td></tr>`;

  win.document.write(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كشف حضور - ${event.title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
      * { font-family: 'Cairo', sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
      body { padding: 30px; color: #0f172a; background: #fff; font-size: 13px; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px; }
      .header h1 { color: #4f46e5; font-size: 20px; font-weight: 900; }
      .info-bar { display: flex; justify-content: space-between; background: #e0e7ff; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-weight: bold; border: 1px solid #c7d2fe; color: #3730a3; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #1e293b; color: #fff; padding: 10px; text-align: center; border: 1px solid #334155; font-size: 12px; }
      td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
      @media print { @page { margin: 10mm; } body { padding: 0; } }
    </style></head><body>
      <div class="header"><div><h1>كشف حضور فعالية / نشاط</h1><p>النقابة العامة للاتصالات بالدقهلية</p></div></div>
      <div class="info-bar">
        <div>الفعالية: ${event.title} (${event.type})</div>
        <div>التاريخ: ${event.date}</div>
        <div>إجمالي الحضور الفعلي: ${totalPax} فرد</div>
      </div>
      <table><thead><tr><th style="width:5%">م</th><th style="width:40%">المشترك والمرافقين</th><th style="width:10%">العدد</th><th style="width:10%">التكلفة</th><th style="width:20%">تفاصيل الدفع</th><th style="width:15%">توقيع الحضور</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <div style="text-align:left; margin-top:30px; font-weight:bold;">توقيع المشرف: ............................</div>
      <script>window.onload=()=>{setTimeout(()=>window.print(), 500);}</script>
    </body></html>
  `);
  win.document.close();
};

export default function EventBookings() {
  const T = useT();
  
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  // حالة الحجز
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [showRes, setShowRes] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [companionsList, setCompanionsList] = useState([]);
  const [boardDiscount, setBoardDiscount] = useState("0"); // "0", "50", "100"

  // حالة الدفع
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState({ cash: "", wallet: "", instapay: "", installment: "" });

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const qEvents = query(collection(db, "events"), where("date", ">=", getTodayISO()));
    const unsubEvents = onSnapshot(qEvents, snap => {
      const evs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      evs.sort((a,b) => a.date.localeCompare(b.date));
      setEvents(evs);
    });
    const qMembers = query(collection(db, "employees"));
    const unsubMembers = onSnapshot(qMembers, snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubEvents(); unsubMembers(); };
  }, []);

  useEffect(() => {
    if (!selectedEventId) { setBookings([]); return; }
    const qBookings = query(collection(db, "event_bookings"), where("eventId", "==", selectedEventId));
    const unsubBookings = onSnapshot(qBookings, snap => {
      const bks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      bks.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setBookings(bks);
      setLoading(false);
    });
    return () => unsubBookings();
  }, [selectedEventId]);

  const activeEvent = useMemo(() => events.find(e => e.id === selectedEventId) || null, [events, selectedEventId]);
  
  const isBoardMember = useMemo(() => {
    if (!selectedMember) return false;
    return BOARD_ROLES.includes(selectedMember.membershipStatus);
  }, [selectedMember]);

  useEffect(() => {
    setBoardDiscount("0");
    setCompanionsList([]);
  }, [selectedMember]);

  const addCompanion = () => {
    setCompanionsList(prev => [...prev, { id: Date.now(), name: "", relation: "", nid: "", phone: "", parsedInfo: null }]);
  };

  const removeCompanion = (id) => {
    setCompanionsList(prev => prev.filter(c => c.id !== id));
  };

  const updateCompanion = (id, field, value) => {
    setCompanionsList(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, [field]: value };
        if (field === 'nid') updated.parsedInfo = parseNationalID(value);
        return updated;
      }
      return c;
    }));
  };

  const memberBasePrice = activeEvent?.isFree ? 0 : Number(activeEvent?.memberPrice || 0);
  const companionBasePrice = activeEvent?.isFree ? 0 : Number(activeEvent?.companionPrice || 0);

  const { memberCost, companionsCost, totalCost } = useMemo(() => {
    if (!activeEvent || !selectedMember) return { memberCost:0, companionsCost:0, totalCost:0 };
    
    let mCost = memberBasePrice;
    if (isBoardMember && !activeEvent.isFree) {
      if (boardDiscount === "50") mCost = memberBasePrice / 2;
      if (boardDiscount === "100") mCost = 0;
    }
    
    const cCost = companionBasePrice * companionsList.length;
    return { memberCost: mCost, companionsCost: cCost, totalCost: mCost + cCost };
  }, [activeEvent, selectedMember, companionsList, isBoardMember, boardDiscount, memberBasePrice, companionBasePrice]);

  const totalPaidInput = Number(payments.cash || 0) + Number(payments.wallet || 0) + Number(payments.instapay || 0) + Number(payments.installment || 0);
  const remainingToPay = totalCost - totalPaidInput;

  const bookedCount = Number(activeEvent?.bookedCount || 0);
  const capacity = Number(activeEvent?.capacity || 1);
  const requestedPax = 1 + companionsList.length;
  const isOverCapacity = (bookedCount + requestedPax) > capacity;
  
  const today = getTodayISO();
  const isBookingClosed = activeEvent && (today < activeEvent.bookingStart || today > activeEvent.bookingEnd);

  const filteredMembers = useMemo(() => {
    if (!searchQ || searchQ.length < 2) return [];
    return members.filter(m => m.name?.includes(searchQ) || m.jobId?.toString().includes(searchQ)).slice(0, 5);
  }, [searchQ, members]);

  // ── تسجيل الحجز ──
  const handleConfirmBooking = async (isPending = false) => {
    if (!activeEvent || !selectedMember) return;
    if (isOverCapacity) return showToast("العدد المطلوب يتجاوز السعة المتبقية للفعالية!", "error");
    if (isBookingClosed) return showToast("التسجيل مغلق في الوقت الحالي وفقاً للمواعيد المحددة", "error");
    
    const invalidCompanions = companionsList.some(c => !c.name.trim() || !c.relation.trim() || c.nid.length !== 14);
    if (invalidCompanions) return showToast("برجاء استكمال بيانات جميع المرافقين (الاسم، الصلة، والرقم القومي 14 رقم)", "error");

    if (!isPending && !activeEvent.isFree && totalCost > 0 && remainingToPay !== 0) {
      return showToast("برجاء توزيع التكلفة على طرق الدفع بحيث يكون المتبقي صفراً.", "error");
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const bookingRef = doc(collection(db, "event_bookings"));
      
      let paymentSummaryStr = "مُعلق (انتظار الدفع)";
      if (!isPending && !activeEvent.isFree) {
        const methods = [];
        if (payments.cash) methods.push(`نقدي: ${payments.cash}`);
        if (payments.wallet) methods.push(`محفظة: ${payments.wallet}`);
        if (payments.instapay) methods.push(`إنستا: ${payments.instapay}`);
        if (payments.installment) methods.push(`قسط/راتب: ${payments.installment}`);
        paymentSummaryStr = methods.join(" | ");
      }

      batch.set(bookingRef, {
        eventId: activeEvent.id,
        eventTitle: activeEvent.title,
        memberId: selectedMember.jobId,
        memberName: selectedMember.name,
        memberPhone: selectedMember.phone || "",
        companionsList: companionsList,
        totalPax: requestedPax,
        totalCost: totalCost,
        isFree: activeEvent.isFree,
        boardDiscountType: boardDiscount,
        status: isPending ? "pending" : "confirmed",
        payments: isPending ? {} : payments,
        paymentSummary: activeEvent.isFree ? "مجاني" : paymentSummaryStr,
        createdAt: serverTimestamp()
      });

      if (isBoardMember && boardDiscount !== "0" && !activeEvent.isFree && !isPending) {
        const rewardAmount = memberBasePrice - memberCost;
        if (rewardAmount > 0) {
          const rewardRef = doc(collection(db, "board_rewards"));
          batch.set(rewardRef, {
            memberId: selectedMember.jobId,
            memberName: selectedMember.name,
            eventId: activeEvent.id,
            eventTitle: activeEvent.title,
            date: getTodayISO(),
            type: "مكافأة عينية - خصم فعالية",
            discountPercentage: boardDiscount + "%",
            rewardValue: rewardAmount,
            createdAt: serverTimestamp()
          });
        }
      }

      const eventRef = doc(db, "events", activeEvent.id);
      batch.update(eventRef, { bookedCount: bookedCount + requestedPax });

      await batch.commit();

      showToast(isPending ? "تم تسجيل الحجز المؤقت (لديك 3 أيام للتأكيد)" : "تم تأكيد الحجز بنجاح ✓", "success");
      setShowPaymentModal(false);
      setSelectedMember(null);
      setSearchQ("");
      setCompanionsList([]);
      setBoardDiscount("0");
      setPayments({ cash: "", wallet: "", instapay: "", installment: "" });

    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء الحجز", "error");
    } finally { setSaving(false); }
  };

  const handleCancelBooking = async (booking, isTimeout = false) => {
    const msg = isTimeout 
      ? `هل تريد استبعاد (${booking.memberName}) لانتهاء مهلة الـ 3 أيام؟\nسيتم إرجاع المقاعد للعداد تلقائياً.` 
      : `هل تريد تسجيل اعتذار للمشترك (${booking.memberName}) واسترداد المبالغ/المقاعد؟`;
    
    if (!window.confirm(msg)) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "event_bookings", booking.id), { 
        status: "cancelled", 
        cancelReason: isTimeout ? "انتهاء المهلة (3 أيام)" : "اعتذار المشترك",
        canceledAt: serverTimestamp() 
      });
      const eventRef = doc(db, "events", activeEvent.id);
      batch.update(eventRef, { bookedCount: Math.max(0, bookedCount - Number(booking.totalPax)) });
      
      await batch.commit();
      showToast(isTimeout ? "تم استبعاد المشترك وإرجاع المقاعد" : "تم إلغاء الحجز، يرجى التوجه للخزينة لرد المبالغ", "success");
    } catch (e) {
      showToast("حدث خطأ أثناء الإلغاء", "error");
    }
  };

  const copyPhonesToClipboard = () => {
    const phones = bookings.filter(b => b.status === "confirmed" && b.memberPhone).map(b => b.memberPhone).join(", ");
    if (!phones) return showToast("لا توجد أرقام هواتف مسجلة", "error");
    navigator.clipboard.writeText(phones);
    showToast("تم نسخ جميع الأرقام للواتساب ✓", "success");
  };

  return (
    <div className={clsx("flex flex-col gap-4 max-w-7xl mx-auto pb-10", T.text)} dir="rtl">
      
      {toast && (
        <div className={clsx("fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-white font-bold animate-in fade-in slide-in-from-top-4", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
          <span className="text-xs">{toast.msg}</span>
        </div>
      )}

      {showPaymentModal && activeEvent && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-lg p-6 rounded-3xl shadow-2xl border space-y-5 animate-in zoom-in-95", T.card)}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="font-black text-sm flex items-center gap-2 text-indigo-600"><CreditCard size={18}/> تفاصيل دفع الاشتراك</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 rounded-lg transition-colors"><X size={16}/></button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي التكلفة المطلوبة</p>
                <p className="text-2xl font-black text-indigo-600">{totalCost.toLocaleString()} <span className="text-xs">ج.م</span></p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase">المتبقي للتوزيع</p>
                <p className={clsx("text-xl font-black", remainingToPay === 0 ? "text-emerald-500" : remainingToPay < 0 ? "text-rose-500" : "text-amber-500")}>
                  {remainingToPay.toLocaleString()} <span className="text-xs">ج.م</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><Banknote size={12}/> دفع نقدي (للخزينة)</label>
                <input type="number" value={payments.cash} onChange={e => setPayments({...payments, cash: e.target.value})} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-black outline-none focus:ring-2 focus:border-emerald-500", T.inp)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-sky-600 flex items-center gap-1"><Smartphone size={12}/> محفظة إلكترونية</label>
                <input type="number" value={payments.wallet} onChange={e => setPayments({...payments, wallet: e.target.value})} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-black outline-none focus:ring-2 focus:border-sky-500", T.inp)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-purple-600 flex items-center gap-1"><Smartphone size={12}/> إنستا باي (InstaPay)</label>
                <input type="number" value={payments.instapay} onChange={e => setPayments({...payments, instapay: e.target.value})} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-black outline-none focus:ring-2 focus:border-purple-500", T.inp)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-rose-600 flex items-center gap-1"><Receipt size={12}/> تقسيط (خصم راتب)</label>
                <input type="number" value={payments.installment} onChange={e => setPayments({...payments, installment: e.target.value})} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-black outline-none focus:ring-2 focus:border-rose-500", T.inp)} placeholder="0" />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
              <button onClick={() => handleConfirmBooking(true)} disabled={saving} className="flex-[1] py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all disabled:opacity-50">حجز مؤقت (3 أيام)</button>
              <button onClick={() => handleConfirmBooking(false)} disabled={saving || remainingToPay !== 0} className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle2 size={16}/> تأكيد الدفع والحجز</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. رأس الصفحة واختيار الفعالية ── */}
      <div className={clsx("p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-5 items-center justify-between bg-white dark:bg-slate-900 z-10 relative", T.card)}>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Ticket size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight">محرك الحجز وإصدار التذاكر</h1>
            <p className={clsx("text-[10px] font-bold mt-0.5", T.muted)}>اختر الفعالية للبدء في حجز المقاعد</p>
          </div>
        </div>

        <div className="w-full md:w-1/3">
          <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className={clsx("w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:border-indigo-500 shadow-sm", T.sel)}>
            <option value="">— اختر الفعالية المفتوحة —</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title} ({e.date})</option>)}
          </select>
        </div>
      </div>

      {activeEvent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in duration-500">
          
          {/* ── 2. ماكينة الحجز ── */}
          <div className={clsx("lg:col-span-4 p-5 rounded-3xl border shadow-sm space-y-5 h-fit", T.card)}>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm flex items-center gap-2 text-indigo-600"><UserPlus size={16}/> تسجيل مشترك ومرافقين</h3>
              <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between text-[10px] font-black mb-1">
                  <span className="text-slate-500">المقاعد المتاحة للرصيد:</span>
                  <span className={isOverCapacity ? "text-rose-600" : "text-teal-600"}>{capacity - bookedCount} من {capacity}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={clsx("h-full rounded-full transition-all", isOverCapacity ? "bg-rose-500" : "bg-indigo-500")} style={{ width: `${Math.min(100, (bookedCount / capacity) * 100)}%` }}/>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1 relative z-[100]">
                <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between">
                  1. ابحث عن العضو
                  {isBookingClosed && <span className="text-rose-500 font-bold animate-pulse">التسجيل مغلق!</span>}
                </label>
                <div className="relative group">
                  <Search size={14} className="absolute right-3 top-3 text-slate-400"/>
                  <input disabled={isBookingClosed} type="text" value={searchQ} onChange={e => { setSearchQ(e.target.value); setShowRes(true); setSelectedMember(null); }} placeholder="الاسم أو الرقم الوظيفي..." className={clsx("w-full pr-9 pl-4 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-indigo-500", T.inp, isBookingClosed && "opacity-50 cursor-not-allowed")} />
                  {showRes && filteredMembers.length > 0 && (
                    <div className={clsx("absolute top-full mt-1 w-full border rounded-xl shadow-2xl overflow-hidden z-[200]", T.card)}>
                      {filteredMembers.map(emp => (
                        <button key={emp.id} type="button" onMouseDown={() => { setSelectedMember(emp); setSearchQ(emp.name); setShowRes(false); }} className="w-full p-2.5 flex items-center justify-between hover:bg-indigo-50 transition-colors border-b last:border-0 text-right">
                          <div><p className="text-[11px] font-black">{emp.name}</p><p className="text-[9px] text-slate-400">{emp.membershipStatus || emp.jobTitle}</p></div>
                          <span className="text-[9px] font-bold bg-slate-100 px-2 py-0.5 rounded-lg">{emp.jobId}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {isBoardMember && !activeEvent.isFree && (
                <div className="p-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-sky-700 dark:text-sky-400"><Award size={14}/> إشراف مجلس الإدارة</div>
                  <select value={boardDiscount} onChange={e => setBoardDiscount(e.target.value)} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none text-sky-800", T.sel)}>
                    <option value="0">دفع اشتراك العضو كاملاً (بدون خصم)</option>
                    <option value="50">إشراف بخصم 50% على اشتراك العضو</option>
                    <option value="100">إشراف واشتراك مجاني 100% للعضو</option>
                  </select>
                  {boardDiscount !== "0" && <p className="text-[9px] font-bold text-sky-600 mt-1">سيتم تسجيل الخصم كمكافأة عينية في سجلات المجلس.</p>}
                </div>
              )}

              {selectedMember && (
                <div className="space-y-2 animate-in fade-in border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase">2. تسجيل المرافقين ({companionsList.length})</label>
                    <button onClick={addCompanion} className="text-[9px] font-black flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-colors"><Plus size={12}/> إضافة مرافق</button>
                  </div>
                  
                  {companionsList.map((comp, idx) => (
                    <div key={comp.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2 relative group">
                      <button onClick={() => removeCompanion(comp.id)} className="absolute top-2 right-2 p-1 text-rose-400 hover:text-rose-600 bg-white dark:bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
                      <p className="text-[9px] font-black text-indigo-500 absolute top-2 left-2">مرافق #{idx + 1}</p>
                      
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <input type="text" placeholder="الاسم رباعي" value={comp.name} onChange={e => updateCompanion(comp.id, "name", e.target.value)} className={clsx("px-2 py-1.5 rounded-lg border text-[10px] font-bold outline-none", T.inp)} />
                        <select value={comp.relation} onChange={e => updateCompanion(comp.id, "relation", e.target.value)} className={clsx("px-2 py-1.5 rounded-lg border text-[10px] font-bold outline-none", T.sel)}>
                          <option value="">- صلة القرابة -</option>
                          <option value="زوج/زوجة">زوج / زوجة</option>
                          <option value="ابن/ابنة">ابن / ابنة</option>
                          <option value="أب/أم">أب / أم</option>
                          <option value="أخ/أخت">أخ / أخت</option>
                          <option value="أخرى">أخرى</option>
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <input type="text" placeholder="رقم الهاتف (اختياري)" value={comp.phone} onChange={e => updateCompanion(comp.id, "phone", e.target.value)} className={clsx("px-2 py-1.5 rounded-lg border text-[10px] font-bold outline-none", T.inp)} />
                        <input type="text" maxLength={14} placeholder="الرقم القومي (14 رقم)" value={comp.nid} onChange={e => updateCompanion(comp.id, "nid", e.target.value)} className={clsx("px-2 py-1.5 rounded-lg border text-[10px] font-bold outline-none", T.inp, comp.nid.length > 0 && comp.nid.length !== 14 && "border-rose-400")} />
                      </div>
                      
                      {comp.parsedInfo && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">{comp.parsedInfo.age} سنة</span>
                          <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">{comp.parsedInfo.gender}</span>
                          <span className="text-[8px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">{comp.parsedInfo.gov}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {isOverCapacity && <p className="text-[9px] font-black text-rose-500 flex gap-1 mt-1"><ShieldAlert size={12}/> العدد المطلوب يتجاوز المتبقي!</p>}
                </div>
              )}

              {selectedMember && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 mt-4">
                  <div className="flex justify-between items-center text-[10px] font-bold mb-1"><span className="text-slate-500">حجز العضو:</span><span>{activeEvent.isFree ? "مجاني" : memberCost === 0 ? "مجاني (إشراف)" : `${memberCost.toLocaleString()} ج`}</span></div>
                  {companionsList.length > 0 && <div className="flex justify-between items-center text-[10px] font-bold mb-2"><span className="text-slate-500">المرافقين ({companionsList.length}):</span><span>{activeEvent.isFree ? "مجاني" : `${companionsCost.toLocaleString()} ج`}</span></div>}
                  <div className="flex justify-between items-center pt-2 border-t border-indigo-200 dark:border-indigo-700">
                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">الإجمالي المطلوب:</span>
                    <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">{totalCost.toLocaleString()} <span className="text-[10px]">ج.م</span></span>
                  </div>
                </div>
              )}

              <button 
                onClick={() => activeEvent.isFree || totalCost === 0 ? handleConfirmBooking(false) : setShowPaymentModal(true)} 
                disabled={!selectedMember || isOverCapacity || isBookingClosed} 
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Ticket size={18}/> {activeEvent.isFree || totalCost === 0 ? "تأكيد الحجز المجاني" : "المتابعة للدفع"}
              </button>
            </div>
          </div>

          {/* ── 3. كشف المشتركين ── */}
          <div className={clsx("lg:col-span-8 p-5 rounded-3xl border shadow-sm flex flex-col min-h-[500px]", T.card)}>
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 gap-3">
              <h3 className="font-black text-sm flex items-center gap-2"><Users size={18} className="text-indigo-600"/> كشف المشتركين ({bookings.filter(b => b.status !== "cancelled").length})</h3>
              
              <div className="flex items-center gap-2">
                <button onClick={copyPhonesToClipboard} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-[10px] transition-all flex items-center gap-1.5 border shadow-sm">
                  <Copy size={14}/> استخراج الأرقام
                </button>
                <button onClick={() => printManifestLocal(activeEvent, bookings)} className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-[10px] transition-all flex items-center gap-1.5 border shadow-sm">
                  <Printer size={14}/> طباعة الكشف
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b">
                  <tr>{["المشترك الأساسي والمرافقين","العدد","التكلفة","طرق الدفع","الحالة","إجراء"].map((h, i) => <th key={i} className="p-3 text-slate-500 font-black">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {bookings.length === 0 ? (
                    <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-bold text-xs border-2 border-dashed rounded-xl mt-4">لا يوجد مشتركون حتى الآن</td></tr>
                  ) : bookings.map((b) => {
                    const isPending = b.status === "pending";
                    const bookingDate = b.createdAt ? new Date(b.createdAt.toMillis()) : new Date();
                    const daysSinceBooking = Math.floor((new Date() - bookingDate) / (1000 * 60 * 60 * 24));
                    const isTimeout = isPending && daysSinceBooking >= 3;

                    return (
                      <tr key={b.id} className={clsx("transition-colors group", b.status === "cancelled" ? "opacity-50 bg-slate-50/30" : isTimeout ? "bg-rose-50/50 dark:bg-rose-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/30")}>
                        <td className="p-3">
                          <p className={clsx("font-black max-w-[250px]", b.status === "cancelled" && "line-through")}>
                            {b.memberName}
                            {b.boardDiscountType && b.boardDiscountType !== "0" && <span className="mr-1 text-[8px] bg-sky-100 text-sky-700 px-1 rounded border border-sky-200">إشراف</span>}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">كود: {b.memberId} {b.memberPhone && `| 📱 ${b.memberPhone}`}</p>
                          {b.companionsList?.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700">
                              {b.companionsList.map((c, i) => <p key={i} className="text-[9px] font-bold text-indigo-500 mb-0.5 truncate max-w-[250px]">- {c.name} ({c.relation})</p>)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-black text-indigo-600">{b.totalPax} أفراد</td>
                        <td className="p-3 font-black text-rose-600">{Number(b.totalCost).toLocaleString()} ج</td>
                        <td className="p-3 text-[9px] font-bold text-slate-500 max-w-[150px]">{b.paymentSummary || "مجاني"}</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span className={clsx("px-2 py-0.5 rounded-md text-[9px] font-black w-max", b.status === "cancelled" ? "bg-rose-100 text-rose-600" : isPending ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")}>
                              {b.status === "cancelled" ? "ملغي" : isPending ? "معلق (الدفع)" : "مؤكد"}
                            </span>
                            {isTimeout && <span className="text-[8px] font-black text-rose-500 animate-pulse flex items-center gap-0.5"><AlertCircle size={10}/> تجاوز 3 أيام</span>}
                          </div>
                        </td>
                        <td className="p-3 text-left">
                          {b.status !== "cancelled" && (
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isPending && <button onClick={() => handleCancelBooking(b, true)} className="p-1.5 text-amber-500 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-lg transition-colors" title="استبعاد لانتهاء المهلة"><UserX size={14}/></button>}
                              <button onClick={() => handleCancelBooking(b, false)} className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-500 hover:text-white rounded-lg transition-colors" title="اعتذار واسترداد"><Trash2 size={14}/></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

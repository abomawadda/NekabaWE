import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collection, query, onSnapshot, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import { useEmployeeModal } from "../../app/providers/GlobalEmployeeModal";
import { logAuditEvent } from "../../utils/auditLog";
import ResponsiveTable from "../../ui/ResponsiveTable";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import BrandHeader from "../../ui/BrandHeader";
import clsx from "clsx";
import {
  ShieldCheck, Users, CalendarDays, Coins, PieChart, Activity,
  Target, PlusCircle, Trash2, Edit3, Eye, CheckCircle2, FileCheck2,
  MapPin, Clock, BadgeCheck, X, Save, Plus, Gavel, BarChart3,
  UserCheck, UserX, FileText, AlertTriangle, ChevronRight,
  Printer, Download, RefreshCw, Filter, Search,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// §1  الثوابت
// ═══════════════════════════════════════════════════════════════

const BOARD_ROLES = ["رئيس المجلس", "الأمين العام", "أمين الصندوق", "عضو مجلس إدارة"];

const ROLE_META = {
  "رئيس المجلس":    { icon: "👑", color: "amber",   meeting_rate: 75 },
  "الأمين العام":   { icon: "📝", color: "teal",    meeting_rate: 75 },
  "أمين الصندوق":   { icon: "💼", color: "emerald", meeting_rate: 75 },
  "عضو مجلس إدارة": { icon: "👤", color: "slate",   meeting_rate: 75 },
};

const MONTHLY_ALLOWANCES = {
  "رئيس المجلس":    { travel: 0, sessions: 0, phone: 0, representation: 0, responsibility: 0 },
  "الأمين العام":   { travel: 0, sessions: 0, phone: 0, representation: 0, responsibility: 0 },
  "أمين الصندوق":   { travel: 0, sessions: 0, phone: 0, representation: 0, responsibility: 0 },
  "عضو مجلس إدارة": { travel: 0, sessions: 0, phone: 0, representation: 0, responsibility: 0 },
};

const ALLOWANCE_LABELS = {
  sessions: "بدل جلسات",
  travel: "بدل انتقال", phone: "بدل تليفون",
  representation: "بدل تمثيل", responsibility: "بدل مسؤولية",
};

const CUSTOM_ALLOWANCE_TYPES = [
  "مكافأة أداء", "بدل سفر خارجي", "بدل مؤتمر", "إعانة طارئة", "بدل تمثيل خاص", "أخرى",
];

const MEETING_TYPES = { ordinary: "عادي", emergency: "طارئ", annual: "سنوي عام", extraordinary: "استثنائي" };
const MEETING_STATUSES = { scheduled: "مجدول", held: "منعقد", cancelled: "ملغي", postponed: "مؤجل" };

const STATUS_COLORS = {
  scheduled:  "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300",
  held:       "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelled:  "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300",
  postponed:  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
};

const MEMBER_STATE_COLORS = {
  وفاة:     "bg-slate-800 text-white border-slate-700",
  استقالة:  "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300",
  معاش:     "bg-purple-100 text-purple-700 border-purple-200",
  موقوف:    "bg-amber-100 text-amber-700 border-amber-200",
  نشط:      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
};
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const formatDate = (ds) => {
  if (!ds) return "—";
  try { return new Date(ds).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return ds; }
};

const getInitials = (name = "") => name.split(" ").slice(0, 2).map(w => w[0]).join("");

const AVATAR_BG = ["bg-teal-600","bg-sky-600","bg-violet-600","bg-amber-600","bg-rose-600","bg-emerald-600","bg-indigo-600","bg-pink-600"];
const avatarBg = (id, idx = 0) => AVATAR_BG[(String(id || idx).charCodeAt(0) || idx) % AVATAR_BG.length];

// ═══════════════════════════════════════════════════════════════
// §2  مكونات مشتركة
// ═══════════════════════════════════════════════════════════════

/** Modal overlay */
function Modal({ open, onClose, title, children, size = "md", actions }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[92vh]", widths[size])}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
            <X size={15} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {/* Footer */}
        {actions && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** FormField wrapper */
function FormField({ label, required, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 font-bold">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600";

/** Stat card */
function BoardStatCard({ label, value, sub, icon: Icon, color, T }) {
  return (
    <div className={clsx("p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group", T.card)}>
      <div className={clsx("w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", `bg-${color}-500/10`)}>
        <Icon size={22} className={`text-${color}-500`} />
      </div>
      <p className={clsx("text-[10px] font-black uppercase tracking-widest mb-1", T.muted)}>{label}</p>
      <p className={clsx("text-3xl font-black leading-none", `text-${color}-600`)}>{value}</p>
      {sub && <p className={clsx("text-[10px] font-bold mt-2", T.muted)}>{sub}</p>}
      <div className={clsx("absolute -bottom-8 -left-8 w-28 h-28 rounded-full opacity-[0.04] blur-2xl group-hover:scale-150 transition-all", `bg-${color}-500`)} />
    </div>
  );
}

/** Status badge */
function StateBadge({ state }) {
  const s = state || "نشط";
  const cls = MEMBER_STATE_COLORS[s] || MEMBER_STATE_COLORS.نشط;
  return <span className={clsx("px-2.5 py-0.5 rounded-lg text-[9px] font-black border", cls)}>{s}</span>;
}

/** Avatar */
function Avatar({ member, size = "md", idx = 0 }) {
  const sz = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-14 h-14 text-base" }[size];
  return (
    <div className={clsx("rounded-full flex items-center justify-center font-black text-white shrink-0 overflow-hidden", sz, avatarBg(member?.id, idx))}>
      {member?.photo ? <img src={member.photo} className="w-full h-full object-cover" alt="" /> : getInitials(member?.name)}
    </div>
  );
}

/** Confirm delete dialog */
function ConfirmDelete({ open, onClose, onConfirm, label }) {
  return (
    <Modal open={open} onClose={onClose} title="تأكيد الحذف" size="sm"
      actions={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">إلغاء</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-xs font-black bg-rose-500 text-white hover:bg-rose-600 transition-all flex items-center gap-1.5"><Trash2 size={13}/> تأكيد الحذف</button>
      </>}
    >
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <AlertTriangle size={28} className="text-rose-500" />
        </div>
        <p className="text-sm font-black text-slate-700 dark:text-slate-200">هل أنت متأكد من حذف</p>
        <p className="text-sm font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-800">{label}</p>
        <p className="text-[11px] text-slate-400 font-bold">لا يمكن التراجع عن هذا الإجراء</p>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// §3  تبويب النظرة العامة (Dashboard)
// ═══════════════════════════════════════════════════════════════

function DashboardTab({ members, meetings, customAllowances, settlementTransactions, T, setActiveTab, openEmployeeModal }) {
  const activeMembers = members.filter(m => !["وفاة","استقالة"].includes(m.memberState)).length;
  const heldMeetings  = meetings.filter(m => m.status === "held").length;
  const decisionsCount = meetings.reduce((acc, m) => acc + (m.decisions?.length || 0), 0);
  const settlementAllowanceTotal = settlementTransactions
    .filter(t => ["advance", "activity"].includes(t.type) && t.isSettled)
    .reduce((sum, tx) => {
      const txTotal = (tx.settlementExpenses || []).reduce((expenseSum, expense) => {
        if (!["بدل انتقال", "بدل جلسات"].includes(expense.category)) return expenseSum;
        return expenseSum + Number(expense.amount || 0);
      }, 0);
      return sum + txTotal;
    }, 0);
  const totalAllowances = members.reduce((sum, m) => {
    const monthly = Object.values(MONTHLY_ALLOWANCES[m.membershipStatus] || {}).reduce((a,b)=>a+b,0) * 12;
    return sum + monthly;
  }, 0) + customAllowances.reduce((s,a)=>s+(a.amount||0),0) + settlementAllowanceTotal;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <BoardStatCard label="أعضاء المجلس" value={members.length} sub={`${activeMembers} نشط`} icon={Users} color="teal" T={T}/>
        <BoardStatCard label="اجتماعات منعقدة" value={heldMeetings} sub={`${meetings.filter(m=>m.status==="scheduled").length} مجدول`} icon={CalendarDays} color="sky" T={T}/>
        <BoardStatCard label="قرارات صادرة" value={decisionsCount} sub="في محاضر رسمية" icon={Gavel} color="amber" T={T}/>
        <BoardStatCard label="تقديري البدلات" value={`${(totalAllowances/1000).toFixed(0)}k`} sub="جنيه مصري" icon={Coins} color="emerald" T={T}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance bars */}
        <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
          <h2 className="text-sm font-black flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <Target size={16} className="text-purple-500"/> نسب حضور الأعضاء
          </h2>
          <div className="space-y-3">
            {members.length === 0 && <p className="text-xs text-slate-400 font-bold">لا توجد بيانات</p>}
            {members.map(m => {
              const attended = meetings.filter(mt => mt.status === "held" && mt.attendees?.includes(m.id)).length;
              const pct = heldMeetings === 0 ? 0 : Math.round((attended / heldMeetings) * 100);
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 w-20 truncate">{m.name?.split(" ").slice(0,2).join(" ")}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full transition-all duration-1000", pct>=85?"bg-emerald-500":pct>=70?"bg-amber-500":"bg-rose-500")} style={{width:`${pct}%`}}/>
                  </div>
                  <span className="text-[11px] font-black w-8">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent meetings */}
        <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-black flex items-center gap-2"><Activity size={16} className="text-teal-500"/> آخر الاجتماعات</h2>
            <button onClick={()=>setActiveTab("meetings")} className="text-[10px] font-black text-amber-600 hover:underline flex items-center gap-1">عرض الكل <ChevronRight size={12}/></button>
          </div>
          <div className="relative border-r-2 border-slate-100 dark:border-slate-800 pr-5 space-y-4 mr-2">
            {meetings.slice(0,4).map(m => (
              <div key={m.id} className="relative">
                <span className={clsx("absolute -right-[25px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900", m.status==="held"?"bg-teal-500":"bg-amber-500")}/>
                <p className="text-[10px] font-bold text-slate-400 mb-0.5">{formatDate(m.date)}</p>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">{m.title}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className={clsx("px-2 py-0.5 rounded-md text-[9px] font-black border", STATUS_COLORS[m.status]||STATUS_COLORS.scheduled)}>{MEETING_STATUSES[m.status]||m.status}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{m.decisions?.length||0} قرارات</span>
                </div>
              </div>
            ))}
            {meetings.length===0 && <p className="text-xs text-slate-400 font-bold">لا توجد اجتماعات</p>}
          </div>
        </div>
      </div>

      {/* Board composition */}
      <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
        <h2 className="text-sm font-black flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <ShieldCheck size={16} className="text-amber-500"/> تركيبة مجلس الإدارة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BOARD_ROLES.map(role => {
            const ms = members.filter(m=>m.membershipStatus===role);
            const meta = ROLE_META[role]||{icon:"👤",color:"slate"};
            return (
              <div key={role} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                <div className="text-2xl mb-2">{meta.icon}</div>
                <div className={clsx("text-[11px] font-black mb-2", `text-${meta.color}-600 dark:text-${meta.color}-400`)}>{role}</div>
                <div className="space-y-1">
                  {ms.map(m=>(
                    <div key={m.id} onClick={()=>openEmployeeModal(m)} className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 cursor-pointer">
                      {m.name?.split(" ").slice(0,2).join(" ")}
                    </div>
                  ))}
                  {ms.length===0 && <div className="text-[10px] text-slate-400">شاغر</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ERB – وثيقة السجل الإلكتروني (مدمجة في اللوحة) */}
      <div className={clsx("p-5 rounded-2xl border shadow-sm bg-gradient-to-br from-amber-500/5 to-transparent", T.card)}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-md shrink-0">⚖️</div>
          <div className="text-center sm:text-right">
            <h3 className="text-sm font-black text-amber-600 dark:text-amber-500">السجل الإلكتروني الرسمي — ERB</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">جميع القرارات الواردة أدناه معتمدة وموثقة رسمياً. الدورة النقابية 2023-2026</p>
          </div>
          <div className="sm:mr-auto flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-[10px] font-black hover:bg-amber-500/20 transition-all flex items-center gap-1"><Printer size={12}/> طباعة</button>
            <button className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1"><Download size={12}/> تصدير</button>
          </div>
        </div>

        {/* Signatories */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {members.filter(m=>!["وفاة","استقالة"].includes(m.memberState)).slice(0,4).map((m,i)=>(
            <div key={m.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/30 text-center flex flex-col items-center gap-2">
              <Avatar member={m} size="md" idx={i}/>
              <div>
                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-tight">{m.name?.split(" ").slice(0,2).join(" ")}</p>
                <p className="text-[9px] font-bold text-amber-600 mt-0.5">{m.membershipStatus}</p>
              </div>
              <div className="w-full h-px bg-slate-200 dark:bg-slate-700 relative">
                <span className="absolute inset-x-0 -top-2 text-center text-[9px] font-mono text-slate-300 italic">Signed</span>
              </div>
              <p className="text-[9px] font-black text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={9}/> موثق</p>
            </div>
          ))}
        </div>

        {/* Decisions log */}
        <h4 className="text-[11px] font-black text-slate-500 mb-3 uppercase tracking-wide">سجل القرارات الرسمية المُصادق عليها</h4>
        <div className="relative border-r-2 border-amber-200 dark:border-amber-900/50 pr-5 space-y-4 mr-2">
          {meetings.filter(m=>m.status==="held").map(meeting=>
            meeting.decisions?.length ? (
              <div key={meeting.id} className="relative">
                <span className="absolute -right-[25px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-amber-500"/>
                <p className="text-[10px] font-bold text-slate-400 mb-1">{formatDate(meeting.date)} • {meeting.title}</p>
                <div className="space-y-1.5">
                  {meeting.decisions.map((d,i)=>(
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1.5">{d.text}</p>
                      <div className="flex gap-3 text-[9px] font-bold">
                        <span className="text-emerald-600">✓ موافق: {d.votes?.for ?? 0}</span>
                        <span className="text-rose-600">✗ معارض: {d.votes?.against ?? 0}</span>
                        <span className="text-slate-400">○ ممتنع: {d.votes?.abstain ?? 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
          {!meetings.some(m=>m.status==="held"&&m.decisions?.length) && (
            <p className="text-xs font-bold text-slate-400">لا توجد قرارات مسجلة بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §4  تبويب الأعضاء (Members) — محافظ على الربط الأصلي
// ═══════════════════════════════════════════════════════════════

function MembersTab({ members, T, openEmployeeModal }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = members.filter(m => {
    const matchFilter =
      filter === "all" ? true :
      filter === "active" ? !["وفاة","استقالة","موقوف"].includes(m.memberState) :
      filter === "inactive" ? ["وفاة","استقالة","موقوف"].includes(m.memberState) :
      m.membershipStatus === filter;
    const matchSearch = !search || (m.name||"").includes(search) || (m.membershipStatus||"").includes(search);
    return matchFilter && matchSearch;
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
        <h2 className="text-lg font-black flex items-center gap-2"><Users size={20} className="text-teal-500"/> أعضاء مجلس الإدارة</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input className={clsx(inputCls,"pr-8 py-2 text-xs w-full sm:w-52")} placeholder="بحث بالاسم..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {[
          {key:"all",label:"الكل"},
          {key:"active",label:"نشط"},
          {key:"رئيس المجلس",label:"الرئيس"},
          {key:"الأمين العام",label:"الأمين"},
          {key:"أمين الصندوق",label:"الصندوق"},
          {key:"عضو مجلس إدارة",label:"الأعضاء"},
          {key:"inactive",label:"غير نشط"},
        ].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} className={clsx("px-3 py-1.5 rounded-full text-[11px] font-black transition-all border",
            filter===f.key?"bg-teal-500 text-white border-teal-500 shadow-sm":"bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:text-teal-600")}>
            {f.label}
          </button>
        ))}
      </div>

      <ResponsiveTable
        data={filtered}
        emptyMessage="لا توجد نتائج مطابقة"
        headers={[
          {label:"العضو والصفة"},
          {label:"جهة العمل / التخصص"},
          {label:"الهاتف"},
          {label:"الحالة",className:"text-center"},
          {label:"ملف",className:"text-left"},
        ]}
        renderDesktopRow={(emp,i)=>(
          <tr onClick={()=>openEmployeeModal(emp)} className={clsx("group transition-all cursor-pointer",
            ["وفاة","استقالة"].includes(emp.memberState)?"bg-rose-50/20 dark:bg-rose-900/10 hover:bg-rose-50/40":"hover:bg-teal-500/5")}>
            <td className="p-3.5">
              <div className="flex items-center gap-3">
                <Avatar member={emp} size="md" idx={i}/>
                <div>
                  <p className={clsx("font-black text-sm",["وفاة","استقالة"].includes(emp.memberState)&&"line-through opacity-60")}>{emp.name}</p>
                  <p className="text-[10px] font-bold text-amber-600 mt-0.5">{emp.membershipStatus}</p>
                </div>
              </div>
            </td>
            <td className="p-3.5">
              <p className="font-bold text-xs text-slate-700 dark:text-slate-300">{emp.workplace||"—"}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{emp.specialization||"—"}</p>
            </td>
            <td className="p-3.5 font-bold text-xs text-slate-500">{emp.phone||"—"}</td>
            <td className="p-3.5 text-center"><StateBadge state={emp.memberState||"نشط"}/></td>
            <td className="p-3.5 text-left">
              <button className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-teal-600 rounded-lg transition-all"><Eye size={15}/></button>
            </td>
          </tr>
        )}
        renderMobileCard={(emp,i)=>(
          <div onClick={()=>openEmployeeModal(emp)} className={clsx("p-4 rounded-2xl border shadow-sm flex gap-3 cursor-pointer hover:shadow-md transition-all",T.card,
            ["وفاة","استقالة"].includes(emp.memberState)&&"border-rose-200 bg-rose-50/20 dark:border-rose-900/50")}>
            <Avatar member={emp} size="lg" idx={i}/>
            <div className="flex-1 min-w-0">
              <h3 className={clsx("font-black text-sm leading-tight",["وفاة","استقالة"].includes(emp.memberState)&&"line-through opacity-60")}>{emp.name}</h3>
              <p className="text-[10px] font-bold text-amber-600 mt-0.5">{emp.membershipStatus}</p>
              {emp.workplace && <p className="text-[10px] text-slate-400 font-bold mt-1">{emp.workplace}</p>}
              <div className="mt-2"><StateBadge state={emp.memberState||"نشط"}/></div>
            </div>
            <Eye size={15} className="text-slate-300 mt-1 shrink-0"/>
          </div>
        )}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §5  تبويب الاجتماعات (Meetings) — جديد ومكتمل
// ═══════════════════════════════════════════════════════════════

const EMPTY_MEETING = { title:"", type:"ordinary", date:"", time:"10:00", venue:"", status:"scheduled", agenda:[""], notes:"" };

function MeetingForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_MEETING, ...initial });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addAgendaItem  = () => set("agenda", [...(form.agenda||[]), ""]);
  const removeAgendaItem = i => set("agenda", form.agenda.filter((_,idx)=>idx!==i));
  const updateAgendaItem = (i,v) => set("agenda", form.agenda.map((a,idx)=>idx===i?v:a));

  const valid = form.title?.trim() && form.date;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="عنوان الاجتماع" required>
          <input className={inputCls} placeholder="مثال: الاجتماع العادي الأول 2025" value={form.title} onChange={e=>set("title",e.target.value)}/>
        </FormField>
        <FormField label="نوع الاجتماع" required>
          <select className={inputCls} value={form.type} onChange={e=>set("type",e.target.value)}>
            {Object.entries(MEETING_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </FormField>
        <FormField label="التاريخ" required>
          <ArabicDatePicker label="" value={form.date} onChange={v=>set("date",v)} />
        </FormField>
        <FormField label="الوقت">
          <input className={inputCls} type="time" value={form.time} onChange={e=>set("time",e.target.value)}/>
        </FormField>
        <FormField label="مكان الانعقاد">
          <input className={inputCls} placeholder="مثال: قاعة الاجتماعات الكبرى" value={form.venue} onChange={e=>set("venue",e.target.value)}/>
        </FormField>
        <FormField label="الحالة">
          <select className={inputCls} value={form.status} onChange={e=>set("status",e.target.value)}>
            {Object.entries(MEETING_STATUSES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </FormField>
      </div>

      {/* Agenda */}
      <FormField label="جدول الأعمال" hint="أضف بنود جدول الأعمال واحدة تلو الأخرى">
        <div className="space-y-2">
          {(form.agenda||[]).map((item,i)=>(
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[11px] font-black text-slate-400 w-5 text-center">{i+1}</span>
              <input className={clsx(inputCls,"flex-1")} placeholder={`البند ${i+1}`} value={item} onChange={e=>updateAgendaItem(i,e.target.value)}/>
              {(form.agenda||[]).length>1 && (
                <button type="button" onClick={()=>removeAgendaItem(i)} className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 transition-all flex items-center justify-center shrink-0">
                  <X size={14}/>
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addAgendaItem} className="flex items-center gap-1.5 text-[11px] font-black text-amber-600 hover:text-amber-700 mt-1 px-2">
            <Plus size={14}/> إضافة بند
          </button>
        </div>
      </FormField>

      <FormField label="ملاحظات">
        <textarea className={clsx(inputCls,"resize-none")} rows={2} placeholder="أي ملاحظات إضافية..." value={form.notes} onChange={e=>set("notes",e.target.value)}/>
      </FormField>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">إلغاء</button>
        <button onClick={()=>valid&&onSave(form)} disabled={!valid||saving} className={clsx("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all",
          valid&&!saving?"bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20":"bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed")}>
          <Save size={13}/>{saving?"جاري الحفظ...":"حفظ الاجتماع"}
        </button>
      </div>
    </div>
  );
}

function MeetingDetail({ meeting, members, onClose, onUpdate, onDelete }) {
  const [decisions, setDecisions] = useState(meeting.decisions||[]);
  const [newDecision, setNewDecision] = useState("");
  const [newDecisionVotes, setNewDecisionVotes] = useState({for:"",against:"",abstain:""});
  const [attendees, setAttendees] = useState(meeting.attendees||[]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const presentCount = attendees.length;

  // Toggle attendance
  const toggleAttendee = async (memberId) => {
    const updated = attendees.includes(memberId) ? attendees.filter(id=>id!==memberId) : [...attendees, memberId];
    setAttendees(updated);
    try {
      await updateDoc(doc(db,"board_meetings",meeting.id),{attendees:updated});
    } catch(e){console.error(e);}
  };

  // Add decision
  const addDecision = async () => {
    if (!newDecision.trim()) return;
    const againstVotes = parseInt(newDecisionVotes.against) || 0;
    const abstainVotes = parseInt(newDecisionVotes.abstain) || 0;
    const explicitForVotes = newDecisionVotes.for === "" ? null : (parseInt(newDecisionVotes.for) || 0);
    const inferredForVotes = explicitForVotes ?? Math.max(presentCount - againstVotes - abstainVotes, 0);
    const totalVotes = inferredForVotes + againstVotes + abstainVotes;

    if (totalVotes > presentCount) {
      alert(`إجمالي الأصوات (${totalVotes}) أكبر من عدد الحاضرين (${presentCount}).`);
      return;
    }

    const d = { text: newDecision.trim(), votes:{for:inferredForVotes,against:againstVotes,abstain:abstainVotes}};
    const updated = [...decisions, d];
    setDecisions(updated);
    setNewDecision(""); setNewDecisionVotes({for:"",against:"",abstain:""});
    try { await updateDoc(doc(db,"board_meetings",meeting.id),{decisions:updated}); } catch(e){console.error(e);}
  };

  // Remove decision
  const removeDecision = async (i) => {
    const updated = decisions.filter((_,idx)=>idx!==i);
    setDecisions(updated);
    try { await updateDoc(doc(db,"board_meetings",meeting.id),{decisions:updated}); } catch(e){console.error(e);}
  };

  // Mark meeting as held
  const markHeld = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db,"board_meetings",meeting.id),{status:"held"});
      await logAuditEvent("board_meeting_marked_held", {
        meetingId: meeting.id,
        title: meeting.title || "",
        date: meeting.date || "",
      });
      onUpdate();
    } catch(e){console.error(e);} finally{setSaving(false);}
  };

  return (
    <>
      <ConfirmDelete open={deleteOpen} onClose={()=>setDeleteOpen(false)} label={meeting.title}
        onConfirm={async()=>{try{await deleteDoc(doc(db,"board_meetings",meeting.id)); await logAuditEvent("board_meeting_deleted", { meetingId: meeting.id, title: meeting.title || "", date: meeting.date || "" }); onDelete();}catch(e){console.error(e);}}}/>
      <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
        {/* Info header */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-200/30 dark:border-amber-800/20">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-black border",STATUS_COLORS[meeting.status]||STATUS_COLORS.scheduled)}>{MEETING_STATUSES[meeting.status]||meeting.status}</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{MEETING_TYPES[meeting.type]||meeting.type}</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{meeting.title}</h3>
            <div className="flex flex-wrap gap-4 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><CalendarDays size={12}/>{formatDate(meeting.date)}</span>
              {meeting.time && <span className="flex items-center gap-1"><Clock size={12}/>{meeting.time}</span>}
              {meeting.venue && <span className="flex items-center gap-1"><MapPin size={12}/>{meeting.venue}</span>}
            </div>
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            {meeting.status==="scheduled" && (
              <button onClick={markHeld} disabled={saving} className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-1">
                <CheckCircle2 size={12}/>{saving?"...":"تأكيد الانعقاد"}
              </button>
            )}
            <button onClick={onUpdate} className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-all flex items-center gap-1"><Edit3 size={12}/> تعديل</button>
            <button onClick={()=>setDeleteOpen(true)} className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200 transition-all flex items-center gap-1"><Trash2 size={12}/> حذف</button>
          </div>
        </div>

        {/* Agenda */}
        {meeting.agenda?.filter(Boolean).length > 0 && (
          <div>
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><FileText size={13}/> جدول الأعمال</h4>
            <div className="space-y-2">
              {meeting.agenda.filter(Boolean).map((item,i)=>(
                <div key={i} className="flex gap-2 items-start p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0">{i+1}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance */}
        <div>
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <UserCheck size={13}/> الحضور والغياب
            <span className="font-bold text-emerald-600 normal-case ml-1">{attendees.length}/{members.length} حضر</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m,i)=>{
              const present = attendees.includes(m.id);
              return (
                <div key={m.id} onClick={()=>toggleAttendee(m.id)} className={clsx("flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all select-none",
                  present?"bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100":"bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800")}>
                  <Avatar member={m} size="sm" idx={i}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{m.name?.split(" ").slice(0,3).join(" ")}</p>
                    <p className="text-[9px] font-bold text-slate-400">{m.membershipStatus}</p>
                  </div>
                  <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    present?"bg-emerald-500 border-emerald-500":"border-slate-300 dark:border-slate-600")}>
                    {present && <CheckCircle2 size={12} className="text-white"/>}
                  </div>
                </div>
              );
            })}
          </div>
          {members.length===0 && <p className="text-xs text-slate-400 font-bold">لا يوجد أعضاء</p>}
        </div>

        {/* Decisions */}
        <div>
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Gavel size={13}/> القرارات الصادرة</h4>
          <div className="space-y-2 mb-3">
            {decisions.map((d,i)=>(
              <div key={i} className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2 items-start flex-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{d.text}</p>
                  </div>
                  <button onClick={()=>removeDecision(i)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-200 transition-all flex items-center justify-center shrink-0">
                    <X size={11}/>
                  </button>
                </div>
                <div className="flex gap-3 mt-1.5 mr-7 text-[9px] font-bold">
                  <span className="text-emerald-600">✓ موافق: {d.votes?.for??0}</span>
                  <span className="text-rose-600">✗ معارض: {d.votes?.against??0}</span>
                  <span className="text-slate-400">○ ممتنع: {d.votes?.abstain??0}</span>
                </div>
              </div>
            ))}
            {decisions.length===0 && <p className="text-[11px] text-slate-400 font-bold py-2">لا توجد قرارات مسجلة</p>}
          </div>

          {/* Add decision */}
          <div className="p-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10 space-y-2">
            <textarea className={clsx(inputCls,"resize-none text-[11px]")} rows={2} placeholder="نص القرار الجديد..." value={newDecision} onChange={e=>setNewDecision(e.target.value)}/>
            <p className="text-[9px] font-black text-slate-500">عدد الحاضرين الحالي: {presentCount}. إذا تُركت خانة "موافق" فارغة فسيتم احتسابها تلقائيًا من الباقي.</p>
            <div className="grid grid-cols-3 gap-2">
              {["for","against","abstain"].map(k=>(
                <div key={k} className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400">{k==="for"?"موافق":k==="against"?"معارض":"ممتنع"}</label>
                  <input type="number" min="0" className={clsx(inputCls,"text-center py-1.5 text-xs")} value={newDecisionVotes[k]} onChange={e=>setNewDecisionVotes(v=>({...v,[k]:e.target.value}))} placeholder="0"/>
                </div>
              ))}
            </div>
            <button onClick={addDecision} disabled={!newDecision.trim()} className={clsx("w-full py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all",
              newDecision.trim()?"bg-amber-500 text-white hover:bg-amber-600":"bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed")}>
              <Plus size={13}/> إضافة قرار
            </button>
          </div>
        </div>

        {meeting.notes && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] font-black text-slate-400 mb-1">ملاحظات</p>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{meeting.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}

function MeetingsTab({ members, meetings, T }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [editMeeting,  setEditMeeting]  = useState(null);
  const [detailMeeting,setDetailMeeting]= useState(null);
  const [saving,       setSaving]       = useState(false);

  const filtered = meetings.filter(m=>{
    const matchStatus = filterStatus==="all" || m.status===filterStatus;
    const matchType   = filterType==="all"   || m.type===filterType;
    const matchSearch = !search || (m.title||"").includes(search) || (m.venue||"").includes(search);
    return matchStatus && matchType && matchSearch;
  });

  const heldCount = meetings.filter(m=>m.status==="held").length;
  const scheduledCount = meetings.filter(m=>m.status==="scheduled").length;

  const saveMeeting = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, agenda: (form.agenda||[]).filter(Boolean), updatedAt: serverTimestamp() };
      if (editMeeting) {
        await updateDoc(doc(db,"board_meetings",editMeeting.id), payload);
        await logAuditEvent("board_meeting_updated", {
          meetingId: editMeeting.id,
          title: form.title || "",
          date: form.date || "",
          status: form.status || "",
        });
      } else {
        await addDoc(collection(db,"board_meetings"), { ...payload, decisions:[], attendees:[], createdAt: serverTimestamp() });
        await logAuditEvent("board_meeting_created", {
          title: form.title || "",
          date: form.date || "",
          status: form.status || "",
        });
      }
      setShowForm(false); setEditMeeting(null);
    } catch(e){console.error(e);} finally{setSaving(false);}
  };

  const openEdit = (meeting) => { setEditMeeting(meeting); setDetailMeeting(null); setShowForm(true); };

  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const getMeetingDay = (ds) => { try { const d=new Date(ds); return {day:d.getDate(),month:monthNames[d.getMonth()],year:d.getFullYear()}; }catch{return {day:"?",month:"?",year:"?"};} };

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      {/* Form Modal */}
      <Modal open={showForm} onClose={()=>{setShowForm(false);setEditMeeting(null);}} title={editMeeting?"تعديل الاجتماع":"إضافة اجتماع جديد"} size="lg">
        <MeetingForm initial={editMeeting||{}} onSave={saveMeeting} onCancel={()=>{setShowForm(false);setEditMeeting(null);}} saving={saving}/>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailMeeting} onClose={()=>setDetailMeeting(null)} title="تفاصيل الاجتماع" size="lg">
        {detailMeeting && (
          <MeetingDetail meeting={detailMeeting} members={members} onClose={()=>setDetailMeeting(null)}
            onUpdate={()=>{setDetailMeeting(null); openEdit(detailMeeting);}}
            onDelete={()=>setDetailMeeting(null)}/>
        )}
      </Modal>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:"إجمالي الاجتماعات",value:meetings.length,color:"text-slate-700 dark:text-slate-200"},
          {label:"منعقد",value:heldCount,color:"text-emerald-600"},
          {label:"مجدول",value:scheduledCount,color:"text-sky-600"},
          {label:"قرارات",value:meetings.reduce((s,m)=>s+(m.decisions?.length||0),0),color:"text-amber-600"},
        ].map((s,i)=>(
          <div key={i} className={clsx("p-4 rounded-2xl border text-center",T.card)}>
            <div className={clsx("text-3xl font-black",s.color)}>{s.value}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Status filter */}
          {[{k:"all",l:"الكل"},{k:"held",l:"منعقد"},{k:"scheduled",l:"مجدول"},{k:"cancelled",l:"ملغي"}].map(f=>(
            <button key={f.k} onClick={()=>setFilterStatus(f.k)} className={clsx("px-3 py-1.5 rounded-full text-[11px] font-black transition-all border",
              filterStatus===f.k?"bg-amber-500 text-white border-amber-500 shadow-sm":"bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600")}>
              {f.l}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block"/>
          {/* Type filter */}
          {[{k:"all",l:"كل الأنواع"},{k:"ordinary",l:"عادي"},{k:"emergency",l:"طارئ"}].map(f=>(
            <button key={f.k} onClick={()=>setFilterType(f.k)} className={clsx("px-3 py-1.5 rounded-full text-[11px] font-black transition-all border",
              filterType===f.k?"bg-sky-500 text-white border-sky-500 shadow-sm":"bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-600")}>
              {f.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto items-center">
          <div className="relative flex-1 sm:flex-none">
            <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input className={clsx(inputCls,"pr-8 py-2 text-xs sm:w-48")} placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button onClick={()=>{setEditMeeting(null);setShowForm(true);}} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20 transition-all whitespace-nowrap shrink-0">
            <Plus size={14}/> اجتماع جديد
          </button>
        </div>
      </div>

      {/* Meetings list */}
      {filtered.length===0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl">
          <CalendarDays size={36} className="text-slate-300 mx-auto mb-3"/>
          <p className="font-black text-slate-400 text-sm">لا توجد اجتماعات</p>
          <p className="text-[11px] text-slate-300 font-bold mt-1">اضغط «اجتماع جديد» للبدء</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(m=>{
          const {day,month,year} = getMeetingDay(m.date);
          const presentCount = m.attendees?.length||0;
          return (
            <div key={m.id} className={clsx("rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer",T.card)}
              onClick={()=>setDetailMeeting(m)}>
              <div className="flex gap-4 p-4">
                {/* Date box */}
                <div className={clsx("rounded-2xl p-3 text-center shrink-0 flex flex-col items-center justify-center min-w-[60px]",
                  m.status==="held"?"bg-emerald-500":m.status==="cancelled"?"bg-rose-500":m.status==="postponed"?"bg-amber-500":"bg-sky-500")}>
                  <span className="text-white text-2xl font-black leading-none">{day}</span>
                  <span className="text-white/80 text-[9px] font-black mt-0.5">{typeof month==="string"?month.substring(0,3):month}</span>
                  <span className="text-white/60 text-[8px] font-bold">{year}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 items-center mb-1.5">
                    <span className={clsx("px-2 py-0.5 rounded-md text-[9px] font-black border",STATUS_COLORS[m.status]||STATUS_COLORS.scheduled)}>
                      {MEETING_STATUSES[m.status]||m.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {MEETING_TYPES[m.type]||m.type}
                    </span>
                    {m.type==="emergency"&&<span className="text-rose-500 text-[9px] font-black">🚨 طارئ</span>}
                  </div>
                  <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{m.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] font-bold text-slate-400">
                    {m.time && <span className="flex items-center gap-0.5"><Clock size={10}/>{m.time}</span>}
                    {m.venue && <span className="flex items-center gap-0.5 truncate max-w-[160px]"><MapPin size={10}/>{m.venue}</span>}
                    {m.status==="held" && <span className="flex items-center gap-0.5 text-emerald-600"><UserCheck size={10}/>{presentCount}/{members.length} حضر</span>}
                  </div>
                </div>

                {/* Right side stats */}
                <div className="text-center shrink-0 hidden sm:flex flex-col items-center justify-center gap-1">
                  <span className="text-2xl font-black text-amber-600">{m.decisions?.length||0}</span>
                  <span className="text-[9px] font-bold text-slate-400">قرار</span>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openEdit(m)} className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200 transition-all flex items-center justify-center">
                    <Edit3 size={13}/>
                  </button>
                  <button onClick={async()=>{try{await deleteDoc(doc(db,"board_meetings",m.id)); await logAuditEvent("board_meeting_deleted", { meetingId: m.id, title: m.title || "", date: m.date || "" });}catch(e){console.error(e);}}}
                    className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-200 transition-all flex items-center justify-center">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>

              {/* Agenda preview */}
              {m.agenda?.filter(Boolean).length>0 && (
                <div className="px-4 pb-3 border-t border-slate-50 dark:border-slate-800/50 pt-2 hidden sm:block">
                  <div className="flex gap-3 flex-wrap">
                    {m.agenda.filter(Boolean).slice(0,3).map((item,i)=>(
                      <div key={i} className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 text-[8px] font-black flex items-center justify-center">{i+1}</span>
                        <span className="truncate max-w-[140px]">{item}</span>
                      </div>
                    ))}
                    {m.agenda.filter(Boolean).length>3 && <span className="text-[10px] font-bold text-slate-400">+{m.agenda.filter(Boolean).length-3} بنود أخرى</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §6  تبويب البدلات — مفعّل مع الإضافة والحذف
// ═══════════════════════════════════════════════════════════════

const EMPTY_CUSTOM_ALLOWANCE = { memberId:"", type:"مكافأة أداء", amount:"", date:"", notes:"" };

function AllowancesTab({ members, meetings, customAllowances, settlementTransactions, T }) {
  const [subTab, setSubTab]     = useState("meetings");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_CUSTOM_ALLOWANCE);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterMember, setFilterMember] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  const matchesPeriod = useCallback((dateValue = "") => {
    const monthValue = String(dateValue || "").slice(5, 7);
    const yearValue = String(dateValue || "").slice(0, 4);
    const monthOk = filterMonth === "all" || monthValue === filterMonth;
    const yearOk = filterYear === "all" || yearValue === filterYear;
    return monthOk && yearOk;
  }, [filterMonth, filterYear]);
  const periodYears = useMemo(() => {
    const dates = [
      ...customAllowances.map((item) => item.date || ""),
      ...settlementTransactions.flatMap((tx) => [
        tx.date || "",
        tx.settlementDate || "",
        ...(tx.settlementExpenses || []).map((expense) => expense.date || ""),
      ]),
    ];
    return [...new Set(dates.map((value) => String(value || "").slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  }, [customAllowances, settlementTransactions]);

  const settlementAllowanceMap = useMemo(() => {
    const result = {};
    settlementTransactions
      .filter(t => ["advance", "activity"].includes(t.type) && t.isSettled)
      .forEach((tx) => {
        (tx.settlementExpenses || []).forEach((expense) => {
          if (!matchesPeriod(expense.date || tx.settlementDate || tx.date || "")) return;
          const allowanceKey =
            expense.category === "بدل انتقال"
              ? "travel"
              : expense.category === "بدل جلسات"
                ? "sessions"
                : null;

          if (!allowanceKey || !Array.isArray(expense.boardMembers) || expense.boardMembers.length === 0) return;

          const perMember = Number(expense.allowancePerMember || 0) || (Number(expense.amount || 0) / expense.boardMembers.length);
          expense.boardMembers.forEach((memberId) => {
            if (!result[memberId]) result[memberId] = { travel: 0, sessions: 0 };
            result[memberId][allowanceKey] += perMember;
          });
        });
      });
    return result;
  }, [matchesPeriod, settlementTransactions]);

  // Session allowances per member from approved settlements only
  const meetingRows = members.map(m=>{
    const sessionExpenses = settlementTransactions
      .filter(t => ["advance", "activity"].includes(t.type) && t.isSettled)
        .flatMap(tx => (tx.settlementExpenses || []).filter(exp => exp.category === "بدل جلسات" && exp.boardMembers?.includes(m.id))
        .map(exp => ({
          meetingTitle: exp.meetingTitle || "جلسة مسواة",
          meetingId: exp.meetingId || "",
          perMember: Number(exp.allowancePerMember || 0),
          date: exp.date || tx.settlementDate || tx.date || "",
        }))
        .filter(item => matchesPeriod(item.date)));

    const uniqueRates = [...new Set(sessionExpenses.map(item => Number(item.perMember || 0)).filter(Boolean))];

    return {
      member: m,
      attendedCount: sessionExpenses.length,
      rate: uniqueRates.length === 1 ? uniqueRates[0] : null,
      total: sessionExpenses.reduce((sum, item) => sum + Number(item.perMember || 0), 0),
      attended: sessionExpenses,
    };
  }).sort((a,b)=>b.total-a.total);

  // Monthly allowances per member
  const monthlyRows = members.map(m=>{
    const baseAllowances = MONTHLY_ALLOWANCES[m.membershipStatus]||{};
    const settlementAllowances = settlementAllowanceMap[m.id] || { travel: 0, sessions: 0 };
    const allowances = Object.keys(ALLOWANCE_LABELS).reduce((acc, key) => {
      acc[key] = Number(baseAllowances[key] || 0) + Number(settlementAllowances[key] || 0);
      return acc;
    }, {});
    const recurringMonthlyTotal = Object.values(baseAllowances).reduce((s,v)=>s+Number(v||0),0);
    const sessionsTotal = Number(settlementAllowances.sessions || 0);
    const travelTotal = Number(settlementAllowances.travel || 0);
    const settlementTotal = travelTotal + sessionsTotal;
    const total = Object.values(allowances).reduce((s,v)=>s+Number(v||0),0);
    return {member:m, allowances, total, recurringMonthlyTotal, settlementTotal, sessionsTotal, travelTotal};
  }).sort((a,b)=>b.total-a.total);

  const grandMeetingTotal  = meetingRows.reduce((s,r)=>s+r.total,0);
  const grandMonthlyTotal  = monthlyRows.reduce((s,r)=>s+r.total,0);
  const grandRecurringMonthlyTotal = monthlyRows.reduce((s,r)=>s+r.recurringMonthlyTotal,0);
  const grandTravelAllowanceTotal = monthlyRows.reduce((s,r)=>s+r.travelTotal,0);
  const grandCustomTotal   = (filterMember==="all" ? customAllowances : customAllowances.filter(a=>a.memberId===filterMember))
    .filter((a) => matchesPeriod(a.date || ""))
    .reduce((s,a)=>s+(a.amount||0),0);

  const saveCustom = async() => {
    if (!form.memberId||!form.amount||!form.date) return;
    setSaving(true);
    try {
      await addDoc(collection(db,"board_allowances"),{...form,amount:parseFloat(form.amount),createdAt:serverTimestamp()});
      await logAuditEvent("board_allowance_created", {
        memberId: form.memberId,
        type: form.type,
        amount: Number(form.amount || 0),
        date: form.date,
      });
      setForm(EMPTY_CUSTOM_ALLOWANCE); setShowForm(false);
    } catch(e){console.error(e);} finally{setSaving(false);}
  };

  const deleteCustom = async(id) => {
    try {
      await deleteDoc(doc(db,"board_allowances",id));
      await logAuditEvent("board_allowance_deleted", {
        allowanceId: id,
        type: deleteTarget?.type || "",
        memberId: deleteTarget?.memberId || "",
        amount: Number(deleteTarget?.amount || 0),
      });
      setDeleteTarget(null);
    } catch(e){console.error(e);}
  };

  const memberName = (id) => members.find(m=>m.id===id)?.name||"—";
  const memberIdx  = (id) => members.findIndex(m=>m.id===id);

  const filteredCustom = (filterMember==="all" ? customAllowances : customAllowances.filter(a=>a.memberId===filterMember))
    .filter((a) => matchesPeriod(a.date || ""));

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      <ConfirmDelete open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} label={deleteTarget?.type||"البدل"}
        onConfirm={()=>deleteCustom(deleteTarget?.id)}/>

      <div className={clsx("p-3 rounded-2xl border flex flex-wrap items-center gap-2", T.card)}>
        <span className="text-[11px] font-black text-slate-400 flex items-center gap-1"><Filter size={12}/> الفترة:</span>
        <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className={clsx(inputCls,"w-auto py-1.5 text-xs min-w-[110px]")}>
          <option value="all">كل الشهور</option>
          {ARABIC_MONTHS.map((month, idx) => (
            <option key={month} value={String(idx + 1).padStart(2, "0")}>{month}</option>
          ))}
        </select>
        <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className={clsx(inputCls,"w-auto py-1.5 text-xs min-w-[95px]")}>
          <option value="all">كل السنوات</option>
          {periodYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-100 dark:border-amber-800/40">
          البدلات حسب الفترة المحددة
        </span>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {label:"بدل الجلسات",value:grandMeetingTotal,color:"text-sky-600"},
          {label:"بدل الانتقال",value:grandTravelAllowanceTotal,color:"text-indigo-600"},
          {label:"البدلات الشهرية",value:grandRecurringMonthlyTotal,color:"text-emerald-600"},
          {label:"بدلات إضافية",value:grandCustomTotal,color:"text-violet-600"},
          {label:"الإجمالي التقديري",value:grandMeetingTotal+grandTravelAllowanceTotal+grandRecurringMonthlyTotal*12+grandCustomTotal,color:"text-amber-600"},
        ].map((s,i)=>(
          <div key={i} className={clsx("p-4 rounded-2xl border text-center",T.card)}>
            <div className={clsx("text-xl font-black",s.color)}>{s.value.toLocaleString()} ج</div>
            <div className="text-[10px] font-bold text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {[
            {k:"meetings",l:"🏛️ بدل الجلسات"},
            {k:"monthly",l:"📅 البدلات الشهرية"},
            {k:"custom",l:"➕ بدلات إضافية"},
            {k:"summary",l:"📊 ملخص"},
          ].map(t=>(
            <button key={t.k} onClick={()=>setSubTab(t.k)} className={clsx("px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border",
              subTab===t.k?"bg-amber-500 text-white border-amber-500 shadow-sm":"bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600")}>
              {t.l}
            </button>
          ))}
        </div>
        {subTab==="custom" && (
          <button onClick={()=>setShowForm(v=>!v)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-violet-500 text-white hover:bg-violet-600 shadow-sm shadow-violet-500/20 transition-all">
            <Plus size={14}/> إضافة بدل
          </button>
        )}
        {subTab==="meetings" && (
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-400 transition-all">
            <Download size={13}/> تصدير
          </button>
        )}
      </div>

      {/* ── بدلات الاجتماعات ── */}
      {subTab==="meetings" && (
        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden",T.card)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3.5 text-right text-[10px] font-black text-slate-500 uppercase tracking-wide">العضو</th>
                  <th className="p-3.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wide">جلسات مسواة</th>
                  <th className="p-3.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wide">نصيب الجلسة</th>
                  <th className="p-3.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wide">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {meetingRows.map((r,i)=>(
                  <tr key={r.member.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-amber-500/3 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar member={r.member} size="sm" idx={i}/>
                        <div>
                          <p className="font-black text-xs text-slate-800 dark:text-slate-100">{r.member.name}</p>
                          <p className="text-[9px] font-bold text-slate-400">{r.member.membershipStatus}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-3 py-1 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs font-black">
                        {r.attendedCount}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-xs font-bold text-slate-500">{typeof r.rate === "number" ? `${r.rate.toLocaleString()} ج` : (r.attendedCount > 0 ? "متغير" : "—")}</td>
                    <td className="p-3.5 text-center font-black text-base text-amber-600">{r.total.toLocaleString()} ج</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 dark:bg-amber-900/10 border-t-2 border-amber-200 dark:border-amber-800/30">
                  <td className="p-3.5 font-black text-xs text-slate-700 dark:text-slate-200" colSpan={3}>الإجمالي الفعلي لبدل الجلسات من التسويات</td>
                  <td className="p-3.5 text-center font-black text-lg text-amber-600">{grandMeetingTotal.toLocaleString()} ج</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── البدلات الشهرية ── */}
      {subTab==="monthly" && (
        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden",T.card)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3.5 text-right text-[10px] font-black text-slate-500 uppercase">العضو</th>
                  {Object.values(ALLOWANCE_LABELS).map(l=><th key={l} className="p-3.5 text-center text-[10px] font-black text-slate-500 uppercase">{l}</th>)}
                  <th className="p-3.5 text-center text-[10px] font-black text-slate-500 uppercase">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r,i)=>(
                  <tr key={r.member.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-emerald-500/3 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar member={r.member} size="sm" idx={i}/>
                        <div>
                          <p className="font-black text-xs text-slate-800 dark:text-slate-100">{r.member.name}</p>
                          <p className="text-[9px] font-bold text-slate-400">{r.member.membershipStatus}</p>
                        </div>
                      </div>
                    </td>
                    {Object.keys(ALLOWANCE_LABELS).map(k=>(
                      <td key={k} className="p-3.5 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        {(r.allowances[k]||0).toLocaleString()} ج
                      </td>
                    ))}
                    <td className="p-3.5 text-center font-black text-base text-emerald-600">{r.total.toLocaleString()} ج</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 dark:bg-emerald-900/10 border-t-2 border-emerald-200 dark:border-emerald-800/30">
                  <td className="p-3.5 font-black text-xs text-slate-700 dark:text-slate-200">الإجمالي الشهري</td>
                  {Object.keys(ALLOWANCE_LABELS).map(k=>(
                    <td key={k} className="p-3.5 text-center font-black text-xs text-emerald-600">
                      {monthlyRows.reduce((s,r)=>s+(r.allowances[k]||0),0).toLocaleString()}
                    </td>
                  ))}
                  <td className="p-3.5 text-center font-black text-lg text-emerald-600">{grandMonthlyTotal.toLocaleString()} ج</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── البدلات الإضافية ── */}
      {subTab==="custom" && (
        <div className="space-y-4">
          {/* Add form (inline) */}
          {showForm && (
            <div className={clsx("p-5 rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-800/50 bg-violet-50/30 dark:bg-violet-900/10",T.card)}>
              <h4 className="text-xs font-black text-violet-700 dark:text-violet-400 mb-4 flex items-center gap-1.5"><Plus size={13}/> إضافة بدل إضافي</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="العضو" required>
                  <select className={inputCls} value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}>
                    <option value="">-- اختر العضو --</option>
                    {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </FormField>
                <FormField label="نوع البدل" required>
                  <select className={inputCls} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {CUSTOM_ALLOWANCE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="المبلغ (جنيه)" required>
                  <input type="number" min="0" className={inputCls} placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
                </FormField>
                <FormField label="التاريخ" required>
                  <ArabicDatePicker label="" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} />
                </FormField>
                <FormField label="ملاحظات" hint="">
                  <input className={inputCls} placeholder="سبب البدل أو الملاحظات..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
                </FormField>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={()=>{setShowForm(false);setForm(EMPTY_CUSTOM_ALLOWANCE);}} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">إلغاء</button>
                <button onClick={saveCustom} disabled={!form.memberId||!form.amount||!form.date||saving}
                  className={clsx("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all",
                    form.memberId&&form.amount&&form.date&&!saving?"bg-violet-500 text-white hover:bg-violet-600 shadow-sm":"bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed")}>
                  <Save size={13}/>{saving?"جاري الحفظ...":"حفظ البدل"}
                </button>
              </div>
            </div>
          )}

          {/* Filter by member */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-black text-slate-400 flex items-center gap-1"><Filter size={12}/> تصفية:</span>
            <select className={clsx(inputCls,"w-auto py-1.5 text-xs")} value={filterMember} onChange={e=>setFilterMember(e.target.value)}>
              <option value="all">كل الأعضاء</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name?.split(" ").slice(0,3).join(" ")}</option>)}
            </select>
          </div>

          {/* List */}
          <div className={clsx("rounded-2xl border shadow-sm overflow-hidden",T.card)}>
            {filteredCustom.length===0 ? (
              <div className="py-12 text-center">
                <Coins size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3"/>
                <p className="font-black text-slate-400 text-sm">لا توجد بدلات إضافية</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      {["العضو","النوع","التاريخ","المبلغ","ملاحظات","حذف"].map(h=>(
                        <th key={h} className={clsx("p-3.5 text-[10px] font-black text-slate-500 uppercase tracking-wide",h==="حذف"?"text-center":"text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustom.map((a,i)=>(
                      <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-violet-500/3 transition-colors group">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar member={members.find(m=>m.id===a.memberId)} size="sm" idx={memberIdx(a.memberId)}/>
                            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {memberName(a.memberId)?.split(" ").slice(0,3).join(" ")}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">{a.type}</span>
                        </td>
                        <td className="p-3.5 text-xs font-bold text-slate-500">{formatDate(a.date)}</td>
                        <td className="p-3.5 font-black text-base text-violet-600">{(a.amount||0).toLocaleString()} ج</td>
                        <td className="p-3.5 text-[11px] text-slate-400 font-bold max-w-[140px] truncate">{a.notes||"—"}</td>
                        <td className="p-3.5 text-center">
                          <button onClick={()=>setDeleteTarget({id:a.id,type:a.type})}
                            className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-all flex items-center justify-center mx-auto opacity-0 group-hover:opacity-100">
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-violet-50 dark:bg-violet-900/10 border-t-2 border-violet-200 dark:border-violet-800/30">
                      <td colSpan={3} className="p-3.5 font-black text-xs text-slate-700 dark:text-slate-200">إجمالي البدلات الإضافية</td>
                      <td className="p-3.5 font-black text-lg text-violet-600">{filteredCustom.reduce((s,a)=>s+(a.amount||0),0).toLocaleString()} ج</td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── الملخص الشامل ── */}
      {subTab==="summary" && (
        <div className="space-y-3">
          {members.map((m,i)=>{
            const monthlyRow = monthlyRows.find(r => r.member.id === m.id);
            const meetTotal = monthlyRow?.sessionsTotal || 0;
            const travelTotal = monthlyRow?.travelTotal || 0;
            const monthTotal = monthlyRow?.recurringMonthlyTotal || 0;
            const customTotal = customAllowances.filter(a=>a.memberId===m.id).reduce((s,a)=>s+(a.amount||0),0);
            const grandTotal = meetTotal + travelTotal + monthTotal*12 + customTotal;
            return (
              <div key={m.id} className={clsx("p-4 rounded-2xl border shadow-sm",T.card)}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar member={m} size="md" idx={i}/>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{m.name}</p>
                    <p className="text-[10px] font-bold text-amber-600">{m.membershipStatus}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xl font-black text-amber-600">{grandTotal.toLocaleString()} ج</div>
                    <div className="text-[9px] font-bold text-slate-400 text-left">إجمالي سنوي</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    {l:"بدل الجلسات",v:meetTotal,c:"text-sky-600"},
                    {l:"بدل الانتقال",v:travelTotal,c:"text-indigo-600"},
                    {l:"البدل الشهري",v:monthTotal,c:"text-emerald-600"},
                    {l:"بدلات إضافية",v:customTotal,c:"text-violet-600"},
                  ].map((s,j)=>(
                    <div key={j} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-center">
                      <div className={clsx("font-black text-sm",s.c)}>{s.v.toLocaleString()}</div>
                      <div className="text-[9px] font-bold text-slate-400 mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §7  تبويب التقارير (محافظ على الربط الأصلي + تحسين)
// ═══════════════════════════════════════════════════════════════

function ReportsTab({ members, meetings, customAllowances, T }) {
  const heldMeetings = meetings.filter(m=>m.status==="held");
  const termDaysLeft = Math.max(0, Math.floor((new Date("2026-01-09")-new Date())/(1000*60*60*24)));
  let totalAttendancePct = 0;
  if (heldMeetings.length>0 && members.length>0) {
    const total = heldMeetings.reduce((acc,m)=>acc+(m.attendees?.length||0),0);
    totalAttendancePct = Math.round((total/(heldMeetings.length*members.length))*100);
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-black flex items-center gap-2"><BarChart3 size={20} className="text-purple-500"/> التقارير والإحصاءات</h2>
        <button className="px-3 py-1.5 rounded-xl text-[11px] font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-400 transition-all flex items-center gap-1">
          <Printer size={13}/> طباعة
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={clsx("p-5 rounded-2xl border shadow-sm text-center",T.card)}>
          <div className="text-[11px] font-black text-slate-400 mb-2">أيام متبقية للولاية</div>
          <div className="text-5xl font-black text-amber-500">{termDaysLeft.toLocaleString("ar-EG")}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">حتى 9 يناير 2026</div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{width:`${Math.max(0,100-(termDaysLeft/1095)*100)}%`}}/>
          </div>
        </div>
        <div className={clsx("p-5 rounded-2xl border shadow-sm text-center",T.card)}>
          <div className="text-[11px] font-black text-slate-400 mb-2">متوسط الحضور العام</div>
          <div className={clsx("text-5xl font-black",totalAttendancePct>=80?"text-emerald-500":totalAttendancePct>=60?"text-amber-500":"text-rose-500")}>{totalAttendancePct}%</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">لجميع الاجتماعات المنعقدة</div>
        </div>
        <div className={clsx("p-5 rounded-2xl border shadow-sm text-center",T.card)}>
          <div className="text-[11px] font-black text-slate-400 mb-2">معدل الإنجاز</div>
          <div className="text-5xl font-black text-sky-500">{heldMeetings.length}/{meetings.length}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">اجتماعات منفذة من المجدول</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={clsx("p-5 rounded-2xl border shadow-sm",T.card)}>
          <h3 className="text-xs font-black mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">توزيع الأعضاء حسب التخصص</h3>
          <div className="space-y-3">
            {Object.entries(members.reduce((acc,m)=>{acc[m.specialization||"غير محدد"]=(acc[m.specialization||"غير محدد"]||0)+1;return acc;},{}))
              .sort((a,b)=>b[1]-a[1]).map(([spec,count])=>(
              <div key={spec} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-28 truncate">{spec}</span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{width:`${(count/Math.max(members.length,1))*100}%`}}/>
                </div>
                <span className="text-[10px] font-black text-purple-600 w-5 text-right">{count}</span>
              </div>
            ))}
            {members.length===0 && <p className="text-xs font-bold text-slate-400">لا توجد بيانات</p>}
          </div>
        </div>

        <div className={clsx("p-5 rounded-2xl border shadow-sm",T.card)}>
          <h3 className="text-xs font-black mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">مؤشرات الأداء الرئيسية (KPIs)</h3>
          <div className="space-y-3">
            {[
              {label:"متوسط القرارات لكل اجتماع", value:heldMeetings.length?(meetings.reduce((s,m)=>s+(m.decisions?.length||0),0)/heldMeetings.length).toFixed(1):0, color:"text-blue-500", icon:"📋"},
              {label:"نسبة تحقيق النصاب القانوني", value:"100%", color:"text-green-500", icon:"✅"},
              {label:"الأعضاء النشطون", value:`${members.filter(m=>m.memberState==="نشط"||!m.memberState).length}/${members.length}`, color:"text-amber-500", icon:"👤"},
              {label:"إجمالي البدلات المصروفة", value:`${(customAllowances.reduce((s,a)=>s+(a.amount||0),0)).toLocaleString()} ج`, color:"text-violet-500", icon:"💰"},
            ].map((kpi,i)=>(
              <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2"><span className="text-base">{kpi.icon}</span><span className="text-[11px] font-bold">{kpi.label}</span></div>
                <div className={clsx("text-sm font-black",kpi.color)}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// §8  المكون الرئيسي BoardDashboard
// ═══════════════════════════════════════════════════════════════

export default function BoardDashboard() {
  const T = useT();
  const { openEmployeeModal } = useEmployeeModal();
  const [activeTab, setActiveTab] = useState("dashboard");

  const [allEmployees,    setAllEmployees]    = useState([]);
  const [meetings,        setMeetings]        = useState([]);
  const [customAllowances,setCustomAllowances]= useState([]);
  const [transactions,    setTransactions]    = useState([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    let empOk=false, meetOk=false, allowOk=false, txOk=false;
    const check = () => { if (empOk && meetOk && allowOk && txOk) setLoading(false); };

    const unsubEmp = onSnapshot(
      query(collection(db,"employees")),
      snap => { setAllEmployees(snap.docs.map(d=>({id:d.id,...d.data()}))); empOk=true; check(); },
      err  => { console.error("employees:",err); empOk=true; check(); }
    );

    const unsubMeet = onSnapshot(
      query(collection(db,"board_meetings"), orderBy("date","desc")),
      snap => { setMeetings(snap.docs.map(d=>({id:d.id,...d.data()}))); meetOk=true; check(); },
      err  => { console.error("board_meetings:",err); meetOk=true; check(); }
    );

    const unsubAllow = onSnapshot(
      query(collection(db,"board_allowances"), orderBy("createdAt","desc")),
      snap => { setCustomAllowances(snap.docs.map(d=>({id:d.id,...d.data()}))); allowOk=true; check(); },
      err  => { console.error("board_allowances:",err); allowOk=true; check(); }
    );

    const unsubTx = onSnapshot(
      query(collection(db,"transactions"), orderBy("date","desc")),
      snap => { setTransactions(snap.docs.map(d=>({id:d.id,...d.data()}))); txOk=true; check(); },
      err  => { console.error("transactions:",err); txOk=true; check(); }
    );

    return () => { unsubEmp(); unsubMeet(); unsubAllow(); unsubTx(); };
  }, []);

  const boardMembers = useMemo(()=>allEmployees.filter(emp=>BOARD_ROLES.includes(emp.membershipStatus)),[allEmployees]);

  const navTabs = [
    { id:"dashboard",  label:"نظرة عامة",    icon:ShieldCheck },
    { id:"members",    label:"أعضاء المجلس", icon:Users        },
    { id:"meetings",   label:"الاجتماعات",   icon:CalendarDays },
    { id:"allowances", label:"البدلات",       icon:Coins        },
    { id:"reports",    label:"التقارير",      icon:PieChart     },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"/>
      <p className="font-black text-slate-400 text-sm animate-pulse">جاري تحميل بيانات المجلس...</p>
    </div>
  );

  return (
    <div className={clsx("max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-500",T.text)} dir="rtl">
      <BrandHeader sectionTitle="منظومة مجلس الإدارة والبدلات" sectionHint="المتابعة الإدارية والمالية والقرارات" className="mb-5" />

      {/* ── شريط الهيدر والتبويبات ── */}
      <div className={clsx(
        "px-4 pt-4 pb-0 rounded-[2rem] border shadow-sm mb-5 sticky top-2 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden",
        T.card
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-black text-amber-600 dark:text-amber-500 flex items-center gap-2">
              <ShieldCheck size={24} className="hidden sm:block"/> مجلس الإدارة
            </h1>
            <p className={clsx("text-[10px] font-bold mt-0.5",T.muted)}>
              اللجنة النقابية • {boardMembers.length} أعضاء • {meetings.filter(m=>m.status==="held").length} اجتماعات
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
            <span className="text-[10px] font-black text-slate-400">مزامنة مباشرة</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-px">
          {navTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={clsx(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-[11px] font-black transition-all whitespace-nowrap border-b-2",
              activeTab===tab.id
                ?"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500"
                :"text-slate-500 dark:text-slate-400 border-transparent hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10"
            )}>
              <tab.icon size={14}/>
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── محتوى التبويبات ── */}
      <div className="mt-2">
        {activeTab==="dashboard"  && <DashboardTab  members={boardMembers} meetings={meetings} customAllowances={customAllowances} settlementTransactions={transactions} T={T} setActiveTab={setActiveTab} openEmployeeModal={openEmployeeModal}/>}
        {activeTab==="members"    && <MembersTab    members={boardMembers} T={T} openEmployeeModal={openEmployeeModal}/>}
        {activeTab==="meetings"   && <MeetingsTab   members={boardMembers} meetings={meetings} T={T}/>}
        {activeTab==="allowances" && <AllowancesTab members={boardMembers} meetings={meetings} customAllowances={customAllowances} settlementTransactions={transactions} T={T}/>}
        {activeTab==="reports"    && <ReportsTab    members={boardMembers} meetings={meetings} customAllowances={customAllowances} T={T}/>}
      </div>
    </div>
  );
}

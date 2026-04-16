import React, { useEffect, useState, useMemo } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { Link } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import BrandHeader from "../../ui/BrandHeader";
import { formatMoney } from "../../utils/numberFormat";
import { excludeMigratedLegacyChecks, getIssuedCheckDisplayParty, getIssuedCheckTypeLabel, normalizeIssuedCheckType, normalizeRequiresSettlement } from "../treasury/helpers/issuedChecks";
// 🎯 استدعاء أداة البطاقة السريعة لتعمل في الشاشة الرئيسية أيضاً
import { useEmployeeModal } from "../../app/providers/GlobalEmployeeModal";
import clsx from "clsx";
import {
  Wallet, TrendingUp, TrendingDown, Users, AlertTriangle,
  ArrowDownRight, ArrowUpRight, FileText, ReceiptText,
  ChevronLeft, RefreshCw, Activity, Calendar, ShieldCheck, Star,
  Briefcase, Landmark, PlusCircle, UserCircle, CreditCard,
  UploadCloud // 👈 تم إضافة أيقونة الرفع هنا
} from "lucide-react";

// ── الثوابت ──
const OPENING_BALANCE = 42685.79;

// 🎯 مصفوفة صفات المجلس للفلترة والترتيب التلقائي
const BOARD_ROLES = ["رئيس المجلس", "الأمين العام", "أمين الصندوق", "عضو مجلس إدارة"];
const ROLE_ORDER = { "رئيس المجلس": 1, "الأمين العام": 2, "أمين الصندوق": 3, "عضو مجلس إدارة": 4 };

// =========================================================
// 1. مكونات فرعية مصغرة
// =========================================================

// ─── بطاقة KPI (الإحصاءات السريعة) ───
function KPICard({ label, value, sub, icon: Icon, color, trend, T }) {
  return (
    <div className={clsx("p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-1 relative overflow-hidden group", T.card)}>
      <div className="flex items-start justify-between relative z-10">
        <div className={clsx("p-3 rounded-xl transition-transform group-hover:scale-110", `bg-${color}-500/10`)}>
          <Icon size={20} className={`text-${color}-500`}/>
        </div>
        {trend != null && (
          <span className={clsx("text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5", trend >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40" : "bg-rose-100 text-rose-700 dark:bg-rose-900/40")}>
            {trend >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3 relative z-10">
        <p className={clsx("text-[10px] font-black uppercase tracking-widest mb-1", T.muted)}>{label}</p>
        <p className={clsx("text-2xl font-black leading-none", `text-${color}-600`)}>{value}</p>
        {sub && <p className={clsx("text-[9px] font-bold mt-1.5", T.muted)}>{sub}</p>}
      </div>
      {/* تأثير دائري جمالي */}
      <div className={clsx("absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-[0.03] blur-xl transition-all group-hover:scale-150", `bg-${color}-500`)}></div>
    </div>
  );
}

// ─── بطاقة وصول سريع ───
function QuickLink({ to, icon: Icon, label, color, desc, T }) {
  return (
    <Link to={to} className={clsx("flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 group", T.card)}>
      <div className={clsx("p-2.5 rounded-lg shrink-0 transition-transform group-hover:scale-110", `bg-${color}-500/10`)}>
        <Icon size={16} className={`text-${color}-500`}/>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black truncate">{label}</p>
        <p className={clsx("text-[9px] font-bold truncate", T.muted)}>{desc}</p>
      </div>
      <ChevronLeft size={14} className={clsx("mr-auto shrink-0", T.muted)}/>
    </Link>
  );
}

// ─── كارت عضو مجلس الإدارة ───
const BoardMember = ({ empData, role, onClick }) => (
  <div 
    onClick={() => onClick(empData)}
    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800 cursor-pointer"
  >
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-sm shrink-0">
      <div className="w-full h-full rounded-[6px] bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center">
        {empData.photo ? <img src={empData.photo} className="w-full h-full object-cover" alt={empData.name}/> : <UserCircle size={20} className="text-amber-500"/>}
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-black text-slate-800 dark:text-white truncate">{empData.name}</p>
      <p className="text-[9px] font-bold text-amber-600 truncate flex items-center gap-1 mt-0.5"><Star size={10}/> {role}</p>
    </div>
  </div>
);

// ─── رسم بياني للحركة الشهرية ───
function MonthlyChart({ transactions, T }) {
  const months = useMemo(() => {
    const map = {};
    transactions.filter(t => t.state === "posted").forEach(t => {
      const m = (t.date || "").slice(3, 10); 
      if (!m) return;
      if (!map[m]) map[m] = { in: 0, out: 0 };
      if (t.type === "deposit") map[m].in += Number(t.amount);
      else map[m].out += Number(t.amount);
    });
    return Object.entries(map).sort((a,b) => {
        const [m1, y1] = a[0].split('-'); const [m2, y2] = b[0].split('-');
        return new Date(y1, m1-1) - new Date(y2, m2-1);
    }).slice(-6); 
  }, [transactions]);

  if (months.length === 0) return null;

  const maxVal = Math.max(...months.flatMap(([, v]) => [v.in, v.out]), 1);
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  return (
    <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
      <div className="flex items-center gap-2 mb-5">
        <Activity size={18} className="text-teal-500"/>
        <h3 className="text-sm font-black">الحركة الشهرية (آخر 6 أشهر)</h3>
        <div className="flex items-center gap-3 mr-auto text-[10px] font-bold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> وارد</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/> منصرف</span>
        </div>
      </div>
      <div className="flex items-end gap-3 h-32">
        {months.map(([month, vals]) => {
          const [mStr] = month.split('-');
          const mIndex = parseInt(mStr) - 1;
          const inH   = Math.round((vals.in  / maxVal) * 112);
          const outH  = Math.round((vals.out / maxVal) * 112);
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-1 h-28 w-full justify-center">
                <div title={`وارد: ${formatMoney(vals.in)}`}
                  className="w-4 sm:w-6 bg-emerald-500/80 rounded-t-md transition-all hover:bg-emerald-500 hover:brightness-110 cursor-pointer"
                  style={{ height: `${Math.max(inH, 4)}px` }}/>
                <div title={`منصرف: ${formatMoney(vals.out)}`}
                  className="w-4 sm:w-6 bg-rose-500/80 rounded-t-md transition-all hover:bg-rose-500 hover:brightness-110 cursor-pointer"
                  style={{ height: `${Math.max(outH, 4)}px` }}/>
              </div>
              <p className={clsx("text-[9px] font-bold mt-1", T.muted)}>{monthNames[mIndex]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================
// 2. الشاشة الرئيسية (اللوحة المدمجة)
// =========================================================

export default function DashboardPage() {
  const T = useT();
  // 🎯 استخراج دالة فتح البطاقة
  const { openEmployeeModal } = useEmployeeModal();

  const [transactions, setTransactions] = useState([]);
  const [issuedChecks, setIssuedChecks] = useState([]);
  const [legacyTransactions, setLegacyTransactions] = useState([]);
  const [employees, setEmployees] = useState([]); 
  const [meetings, setMeetings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [empCount,     setEmpCount]     = useState(0);
  const [loadingTx,    setLoadingTx]    = useState(true);

  const [dateStr, setDateStr] = useState("");

  // ── جلب البيانات ──
  useEffect(() => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setDateStr(new Date().toLocaleDateString('ar-EG', options));

    let checksReady = false;
    let legacyReady = false;
    const finishTxLoading = () => {
      if (checksReady && legacyReady) setLoadingTx(false);
    };

    const qChecks = query(collection(db, "issued_checks"), orderBy("date", "desc"));
    const unsubChecks = onSnapshot(qChecks, snap => {
      setIssuedChecks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      checksReady = true;
      finishTxLoading();
    }, err => {
      console.error("issued_checks:", err);
      setIssuedChecks([]);
      checksReady = true;
      finishTxLoading();
    });

    const qTx = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTx = onSnapshot(qTx, snap => {
      setLegacyTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      legacyReady = true;
      finishTxLoading();
    }, err => {
      console.error("transactions:", err);
      setLegacyTransactions([]);
      legacyReady = true;
      finishTxLoading();
    });

    const qEmp = query(collection(db, "employees"));
    const unsubEmp = onSnapshot(qEmp, snap => {
      const empData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(empData);
      setEmpCount(snap.size);
    });

    const qMeet = query(collection(db, "board_meetings"), orderBy("date", "desc"));
    const unsubMeet = onSnapshot(qMeet, snap => {
      setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qAudit = query(collection(db, "audit_logs"));
    const unsubAudit = onSnapshot(qAudit, snap => {
      setAuditLogs(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.createdAtIso || "").localeCompare(String(a.createdAtIso || "")))
          .slice(0, 6)
      );
    });

    return () => { unsubChecks(); unsubTx(); unsubEmp(); unsubMeet(); unsubAudit(); };
  }, []);

  useEffect(() => {
    const filteredLegacy = excludeMigratedLegacyChecks(
      legacyTransactions,
      issuedChecks
    );
    const merged = [
      ...filteredLegacy.map((tx) => ({ ...tx, type: normalizeIssuedCheckType(tx.type) })),
      ...issuedChecks.map((tx) => ({ ...tx, type: normalizeIssuedCheckType(tx.type) })),
    ];
    setTransactions(merged);
  }, [issuedChecks, legacyTransactions]);

  // ── الحسابات والإحصاءات ──
  const posted       = useMemo(() => transactions.filter(t => t.state === "posted" || t.state === "approved" || !t.state), [transactions]);
  const totalIn      = useMemo(() => posted.filter(t => t.type === "deposit").reduce((s,t) => s+Number(t.amount),0), [posted]);
  const totalOut     = useMemo(() => posted.filter(t => t.type !== "deposit").reduce((s,t) => s+Number(t.amount || 0),0), [posted]);
  const balance      = OPENING_BALANCE + totalIn - totalOut;
  const openAdvances = useMemo(() => transactions.filter(t => normalizeRequiresSettlement(t) && !t.isSettled && (t.state === "posted" || t.state === "approved" || !t.state)), [transactions]);
  const drafts       = useMemo(() => transactions.filter(t => t.state === "draft").length, [transactions]);
  const recentTx     = useMemo(() => transactions.slice(0, 6), [transactions]);
  const operationalAlerts = useMemo(() => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const getAgeDays = (dateValue) => {
      const parsed = new Date(dateValue || "");
      if (Number.isNaN(parsed.getTime())) return 0;
      return Math.floor((Date.now() - parsed.getTime()) / msPerDay);
    };

    const staleAdvances = openAdvances.filter((tx) => getAgeDays(tx.date) >= 30);
    const unsettledActivities = transactions.filter((tx) => (tx.type === "event" || tx.type === "trip") && !tx.isSettled && (tx.state === "posted" || tx.state === "approved" || !tx.state));
    const sessionWithoutMeeting = transactions
      .filter((tx) => (normalizeRequiresSettlement(tx) || tx.type === "advance") && tx.isSettled)
      .flatMap((tx) =>
        (tx.settlementExpenses || [])
          .filter((expense) => expense.category === "بدل جلسات" && !expense.meetingId)
          .map((expense) => ({ tx, expense }))
      );
    const invalidVotesMeetings = meetings.filter((meeting) =>
      (meeting.decisions || []).some((decision) => {
        const presentCount = meeting.attendees?.length || 0;
        const voteTotal =
          Number(decision?.votes?.for || 0) +
          Number(decision?.votes?.against || 0) +
          Number(decision?.votes?.abstain || 0);
        return voteTotal > presentCount;
      })
    );

    return [
      staleAdvances.length > 0 ? {
        key: "stale-advances",
        tone: "amber",
        title: "شيكات تسوية متأخرة",
        body: `${staleAdvances.length} شيك مر عليه 30 يومًا أو أكثر بدون تسوية.`,
        to: "/treasury/settlements",
      } : null,
      unsettledActivities.length > 0 ? {
        key: "open-activities",
        tone: "sky",
        title: "رحلات أو فاعليات لم تُسوَّ بعد",
        body: `${unsettledActivities.length} شيك من نوع رحلة أو فاعلية ما زال في انتظار الإقفال المالي.`,
        to: "/treasury/settlements",
      } : null,
      sessionWithoutMeeting.length > 0 ? {
        key: "session-without-meeting",
        tone: "rose",
        title: "بدل جلسات بلا اجتماع",
        body: `${sessionWithoutMeeting.length} بند جلسات معتمد غير مربوط باجتماع محدد.`,
        to: "/board",
      } : null,
      invalidVotesMeetings.length > 0 ? {
        key: "invalid-votes",
        tone: "violet",
        title: "محاضر تحتاج مراجعة",
        body: `${invalidVotesMeetings.length} اجتماع به أصوات تتجاوز عدد الحاضرين.`,
        to: "/board",
      } : null,
    ].filter(Boolean);
  }, [meetings, openAdvances, transactions]);

  // 🎯 1. فلترة أعضاء المجلس النشطين فقط
  // 🎯 2. ترتيبهم بحسب المنصب (الرئيس أولاً)
  const sortedBoardMembers = useMemo(() => {
    const board = employees.filter(emp => 
      BOARD_ROLES.includes(emp.membershipStatus) && 
      emp.memberState !== "وفاة" && 
      emp.memberState !== "استقالة"
    );
    
    return board.sort((a, b) => {
      const orderA = ROLE_ORDER[a.membershipStatus] || 99;
      const orderB = ROLE_ORDER[b.membershipStatus] || 99;
      return orderA - orderB;
    });
  }, [employees]);

  if (loadingTx) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-black text-slate-400 animate-pulse text-sm">جاري معالجة بيانات المنظومة...</p>
    </div>
  );

  return (
    <div className={clsx("max-w-[1600px] mx-auto space-y-5 pb-20 animate-in fade-in duration-700", T.text)} dir="rtl">
      <BrandHeader sectionTitle="لوحة المتابعة والتشغيل" sectionHint="مؤشرات فورية وتنبيهات تشغيلية وسجل آخر الإجراءات" />
      
      {/* ── 1. شريط الترحيب والإنذارات ── */}
      <div className={clsx("p-5 px-6 rounded-2xl border shadow-sm relative overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4", T.card)}>
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-teal-500/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-teal-600 dark:text-teal-400 tracking-tight">مركز القيادة والسيطرة</h1>
          <p className={clsx("text-[11px] font-bold mt-1 flex items-center gap-1.5", T.muted)}>
            <Calendar size={12}/> {dateStr}
          </p>
        </div>
        <div className="relative z-10 flex gap-2">
          {drafts > 0 && (
            <Link to="/treasury/admin?filter=draft" className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border border-amber-400/30 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-black animate-pulse hover:bg-amber-500/20 transition-colors">
              <AlertTriangle size={14}/> {drafts} شيك مسودة
            </Link>
          )}
          <button className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-black shadow-md hover:bg-teal-700 transition-all flex items-center gap-1.5 active:scale-95">
            <PlusCircle size={14}/> إجراء سريع
          </button>
        </div>
      </div>

      {/* ── 2. بطاقات الإحصاءات السريعة (KPIs) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="الرصيد الدفتري الحالي" value={formatMoney(balance)} sub={`افتتاحي: ${formatMoney(OPENING_BALANCE)}`} icon={Wallet} color={balance >= 0 ? "teal" : "rose"} T={T} />
        <KPICard label="إجمالي المقبوضات" value={formatMoney(totalIn)} sub={`${posted.filter(t=>t.type==="deposit").length} حركة مرحّلة`} icon={TrendingUp} color="emerald" trend={2.4} T={T} />
        <KPICard label="إجمالي المدفوعات" value={formatMoney(totalOut)} sub="إعانات · سلف · رحلات · فاعليات" icon={TrendingDown} color="rose" trend={-1.2} T={T} />
        <KPICard label="الأعضاء المسجلون" value={empCount} sub="مزامنة فورية" icon={Users} color="sky" trend={5.0} T={T} />
      </div>

      {/* ── 3. تنبيه العهد المفتوحة ── */}
      {openAdvances.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 flex items-center gap-4 shadow-sm animate-in slide-in-from-top-4">
          <div className="p-2.5 bg-amber-500 text-white rounded-lg shrink-0 animate-spin-slow"><RefreshCw size={16}/></div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-amber-800 dark:text-amber-400 text-sm">يوجد ({openAdvances.length}) شيك بانتظار التسوية</p>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-0.5 truncate">{openAdvances.map(a => getIssuedCheckDisplayParty(a)).join(" — ")}</p>
          </div>
          <Link to="/treasury/settlements" className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-xs font-black hover:bg-amber-600 transition shadow-sm active:scale-95 whitespace-nowrap">تسوية الآن</Link>
        </div>
      )}

      {/* ── 4. القسم الأوسط ── */}
      {operationalAlerts.length > 0 && (
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-black flex items-center gap-2"><AlertTriangle size={16} className="text-rose-500"/> التنبيهات التشغيلية</h2>
            <span className="text-[10px] font-black text-slate-400">{operationalAlerts.length} تنبيه</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {operationalAlerts.map((alert) => (
              <Link key={alert.key} to={alert.to} className={clsx(
                "p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md",
                alert.tone === "amber" && "bg-amber-50 border-amber-200 text-amber-800",
                alert.tone === "sky" && "bg-sky-50 border-sky-200 text-sky-800",
                alert.tone === "rose" && "bg-rose-50 border-rose-200 text-rose-800",
                alert.tone === "violet" && "bg-violet-50 border-violet-200 text-violet-800"
              )}>
                <p className="text-sm font-black">{alert.title}</p>
                <p className="text-[11px] font-bold mt-1 opacity-80">{alert.body}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        <div className="lg:col-span-2 space-y-5">
          {/* بوابات النظام (محدثة بإضافة زر الاستيراد وتنسيق sm:grid-cols-5) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { title: "الأعضاء", icon: Users, color: "teal", link: "/employees" },
              { title: "إصدار شيك", icon: Wallet, color: "emerald", link: "/treasury/admin" },
              { title: "التسويات", icon: Briefcase, color: "amber", link: "/treasury/settlements" },
              { title: "كشف الحساب", icon: ReceiptText, color: "purple", link: "/treasury/ledger" },
              { title: "استيراد بيانات", icon: UploadCloud, color: "blue", link: "/importer" }, // 👈 الزر الجديد هنا
            ].map((mod, i) => {
              const MIcon = mod.icon;
              return (
                <Link key={i} to={mod.link} className={clsx("p-4 rounded-2xl border shadow-sm flex flex-col items-center text-center gap-2 transition-all hover:shadow-md hover:-translate-y-1 group", T.card)}>
                  <div className={clsx("p-3 rounded-xl transition-transform group-hover:scale-110", `bg-${mod.color}-100 text-${mod.color}-600 dark:bg-${mod.color}-900/30`)}>
                    <MIcon size={20}/>
                  </div>
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white group-hover:text-teal-600 transition-colors">{mod.title}</h4>
                </Link>
              )
            })}
          </div>

          {/* آخر الحركات */}
          <div className={clsx("rounded-2xl border shadow-sm overflow-hidden", T.card)}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-black flex items-center gap-2"><FileText size={16} className="text-teal-500"/> أحدث الحركات المالية المرحّلة</h3>
              <Link to="/treasury/admin" className={clsx("text-[10px] font-black flex items-center gap-1 hover:text-teal-600 transition", T.muted)}>عرض الدفتر <ChevronLeft size={12}/></Link>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {recentTx.length === 0 ? (
                <p className="p-8 text-center text-slate-400 text-xs font-bold border-dashed border-2 border-slate-100 m-4 rounded-xl">لا توجد حركات مالية مسجلة بعد</p>
              ) : recentTx.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className={clsx("p-2.5 rounded-xl shrink-0", tx.type === "deposit" ? "bg-emerald-500/10" : tx.type === "aid" ? "bg-sky-500/10" : "bg-purple-500/10")}>
                    {tx.type === "deposit" ? <ArrowDownRight size={16} className="text-emerald-500"/> : <ArrowUpRight size={16} className={tx.type === "aid" ? "text-sky-500" : "text-purple-500"}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate text-slate-800 dark:text-slate-100">{getIssuedCheckDisplayParty(tx) || "—"}</p>
                    <p className={clsx("text-[9px] font-bold truncate mt-0.5", T.muted)}>{getIssuedCheckTypeLabel(tx.type)}{tx.notes ? ` — ${tx.notes}` : ""}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className={clsx("text-[13px] font-black", tx.type === "deposit" ? "text-emerald-600" : "text-rose-600")}>
                      {tx.type === "deposit" ? "+" : "−"}{formatMoney(tx.amount)}
                    </p>
                    <p className={clsx("text-[8px] font-bold mt-0.5", T.muted)}>{tx.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <MonthlyChart transactions={transactions} T={T} />
        </div>

        <div className="space-y-5">
          <div className={clsx("p-4 rounded-2xl border shadow-sm space-y-3", T.card)}>
            <h3 className="text-[11px] font-black px-1 text-slate-500 flex items-center gap-1.5"><Landmark size={14}/> عمليات الخزينة</h3>
            <QuickLink to="/treasury/admin?type=aid" icon={ArrowUpRight} label="إصدار إعانة" desc="زواج، وفاة، ظروف" color="sky" T={T}/>
            <QuickLink to="/treasury/admin?type=advance" icon={ArrowUpRight} label="إصدار سلفة" desc="عهدة ومصروفات بعهدة" color="purple" T={T}/>
            <QuickLink to="/treasury/admin?type=trip" icon={ArrowUpRight} label="إصدار رحلة" desc="شيك + اشتراكات الأعضاء" color="indigo" T={T}/>
            <QuickLink to="/treasury/admin?type=bank_charge" icon={CreditCard} label="خصم مباشر" desc="عمولات ومصاريف بنكية" color="slate" T={T}/>
            <QuickLink to="/treasury/settlements" icon={ReceiptText} label="تسوية شيك" desc="إغلاق ومطابقة الفواتير" color="amber" T={T}/>
          </div>

          {/* 🎯 مجلس الإدارة مبني برمجياً ومتصل بالقاعدة */}
          <div className={clsx("p-5 rounded-2xl border shadow-sm flex flex-col", T.card)}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h2 className="text-sm font-black flex items-center gap-2"><ShieldCheck size={16} className="text-amber-500"/> تشكيل مجلس الإدارة</h2>
            </div>
            
            <div className="flex-1 space-y-1">
              {sortedBoardMembers.slice(0, 5).map(emp => (
                <BoardMember 
                  key={emp.id}
                  onClick={openEmployeeModal} 
                  empData={emp} 
                  role={emp.membershipStatus} 
                />
              ))}
              
              {sortedBoardMembers.length === 0 && (
                <div className="text-center py-6 text-[11px] font-bold text-slate-400">
                  لا يوجد أعضاء مجلس إدارة مسجلين حالياً
                </div>
              )}
            </div>

            <Link to="/board" className="w-full mt-3 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-amber-600 transition-all flex items-center justify-center gap-1.5">
              إدارة المجلس وتشكيله <ChevronLeft size={12}/>
            </Link>
          </div>

          <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h2 className="text-sm font-black flex items-center gap-2"><FileText size={16} className="text-teal-500"/> آخر الإجراءات</h2>
              <span className="text-[10px] font-black text-slate-400">{auditLogs.length} سجل</span>
            </div>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                  <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{log.action || "إجراء"}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">
                    {log.details?.party || log.details?.title || log.details?.type || "بدون وصف إضافي"}
                  </p>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="text-center py-6 text-[11px] font-bold text-slate-400">لا توجد سجلات تدقيق بعد</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}

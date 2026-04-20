import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import clsx from "clsx";
import { Edit3, Plus, PlusCircle, Save, X } from "lucide-react";
import { db } from "../../app/providers/FirebaseProvider";
import { logAuditEvent } from "../../utils/auditLog";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import {
  BOARD_MEMBERSHIPS_COLLECTION,
  BOARD_TERMS_COLLECTION,
  buildBoardMembershipSnapshot,
  buildBoardMemberViewsFromMemberships,
  normalizeBoardMembership,
  normalizeBoardTerm,
  sortBoardTerms,
} from "./boardLifecycle";
import { BOARD_MEMBERSHIP_ROLES } from "../../utils/memberBenefits";

const TARGET_BOARD_SIZE = 11;
const VIRTUAL_ACTIVE_TERM_ID = "__legacy_active_term__";

const BOARD_ROLE_ORDER = {
  "رئيس المجلس": 1,
  "الأمين العام": 2,
  "أمين الصندوق": 3,
  "نائب الرئيس": 4,
  "عضو مجلس إدارة": 5,
  "عضو مجلس": 6,
};

const TERM_STATUS_OPTIONS = [
  { value: "planned", label: "مخططة" },
  { value: "active", label: "نشطة" },
  { value: "closed", label: "منتهية" },
  { value: "archived", label: "مؤرشفة" },
];

const MEMBERSHIP_STATUS_OPTIONS = [
  { value: "active", label: "سارية" },
  { value: "ended", label: "منتهية" },
  { value: "suspended", label: "موقوفة" },
  { value: "vacated", label: "شاغرة" },
];

const JOIN_METHOD_OPTIONS = [
  { value: "elected", label: "انتخاب" },
  { value: "escalated", label: "تصعيد" },
  { value: "appointed", label: "تعيين" },
  { value: "replacement", label: "بديل" },
  { value: "legacy", label: "ترحيل قديم" },
];

const END_REASON_OPTIONS = [
  { value: "", label: "بدون" },
  { value: "term_completed", label: "انتهاء الدورة" },
  { value: "retirement", label: "معاش" },
  { value: "death", label: "وفاة" },
  { value: "resignation", label: "استقالة" },
  { value: "dismissal", label: "إسقاط/استبعاد" },
  { value: "membership_end", label: "انتهاء العضوية" },
  { value: "board_restructure", label: "إعادة تشكيل" },
];

const TERM_STATUS_LABELS = Object.fromEntries(TERM_STATUS_OPTIONS.map((option) => [option.value, option.label]));
const MEMBERSHIP_STATUS_LABELS = Object.fromEntries(MEMBERSHIP_STATUS_OPTIONS.map((option) => [option.value, option.label]));
const JOIN_METHOD_LABELS = Object.fromEntries(JOIN_METHOD_OPTIONS.map((option) => [option.value, option.label]));
const END_REASON_LABELS = Object.fromEntries(END_REASON_OPTIONS.map((option) => [option.value, option.label]));

const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600";

const chipClass = (tone = "slate") =>
  ({
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40",
    sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/40",
    rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40",
    slate: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  }[tone] || "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700");

const sortBoardMembers = (members = []) =>
  [...members].sort((a, b) => {
    const roleDiff = (BOARD_ROLE_ORDER[String(a.boardRoleTitle || a.membershipStatus || "").trim()] || 99) - (BOARD_ROLE_ORDER[String(b.boardRoleTitle || b.membershipStatus || "").trim()] || 99);
    if (roleDiff !== 0) return roleDiff;
    return String(a.name || "").localeCompare(String(b.name || ""), "ar");
  });

function Modal({ open, onClose, title, children, actions, size = "lg" }) {
  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[92vh]", widths[size] || widths.lg)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          {actions}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Avatar({ member, idx = 0 }) {
  const palette = ["bg-teal-600", "bg-sky-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-emerald-600"];
  const bg = palette[(String(member?.id || idx).charCodeAt(0) || idx) % palette.length];
  const initials = String(member?.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("");

  return <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0", bg)}>{initials || "؟"}</div>;
}

function createEmptyBoardTermForm() {
  return {
    title: "",
    termNumber: "",
    startDate: "",
    endDate: "",
    status: "planned",
    electionDate: "",
    approvalDate: "",
    approvalRef: "",
    targetSeats: TARGET_BOARD_SIZE,
    notes: "",
  };
}

function createEmptyBoardMembershipForm(termId = "") {
  return {
    termId,
    memberId: "",
    role: BOARD_MEMBERSHIP_ROLES[0] || "",
    joinDate: "",
    endDate: "",
    status: "active",
    joinMethod: "elected",
    endReason: "",
    decisionDate: "",
    decisionRef: "",
    replacementForMembershipId: "",
    escalationSourceMemberId: "",
    notes: "",
  };
}

export default function BoardTermsTab({
  boardTerms,
  memberships,
  allEmployees,
  activeTerm,
  T,
  openEmployeeModal,
}) {
  const normalizedTerms = useMemo(
    () => sortBoardTerms(boardTerms.map((term) => normalizeBoardTerm(term))),
    [boardTerms]
  );
  const [selectedTermId, setSelectedTermId] = useState("");
  const [showTermModal, setShowTermModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [editingMembership, setEditingMembership] = useState(null);
  const [termForm, setTermForm] = useState(createEmptyBoardTermForm());
  const [membershipForm, setMembershipForm] = useState(createEmptyBoardMembershipForm());
  const [savingTerm, setSavingTerm] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);

  useEffect(() => {
    const candidateIds = [...normalizedTerms.map((term) => term.id), activeTerm?.id].filter(Boolean);
    if (!selectedTermId || !candidateIds.includes(selectedTermId)) {
      setSelectedTermId(normalizedTerms.find((term) => term.id === activeTerm?.id)?.id || normalizedTerms[0]?.id || activeTerm?.id || "");
    }
  }, [activeTerm?.id, normalizedTerms, selectedTermId]);

  const selectedTerm =
    normalizedTerms.find((term) => term.id === selectedTermId) ||
    (activeTerm?.id === selectedTermId ? activeTerm : null) ||
    normalizedTerms[0] ||
    activeTerm ||
    null;
  const canManageMemberships = Boolean(selectedTerm?.id);

  const membershipsForSelectedTerm = useMemo(
    () =>
      memberships
        .filter((membership) => (selectedTerm?.id ? membership.termId === selectedTerm.id : true))
        .map((membership) => normalizeBoardMembership(membership)),
    [memberships, selectedTerm?.id]
  );

  const membershipViews = useMemo(
    () => sortBoardMembers(buildBoardMemberViewsFromMemberships(membershipsForSelectedTerm, allEmployees, { termId: selectedTerm?.id })),
    [allEmployees, membershipsForSelectedTerm, selectedTerm?.id]
  );
  const membershipsMap = useMemo(
    () =>
      new Map(
        membershipsForSelectedTerm.map((membership) => {
          const normalizedMembership = normalizeBoardMembership(membership);
          return [normalizedMembership.id, normalizedMembership];
        })
      ),
    [membershipsForSelectedTerm]
  );
  const employeesMap = useMemo(
    () => new Map((allEmployees || []).map((employee) => [employee.id, employee])),
    [allEmployees]
  );

  const selectableEmployees = useMemo(
    () => [...allEmployees].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar")),
    [allEmployees]
  );
  const replacementMembershipOptions = useMemo(
    () =>
      membershipsForSelectedTerm
        .map((membership) => normalizeBoardMembership(membership))
        .sort((a, b) => String(a.memberName || "").localeCompare(String(b.memberName || ""), "ar")),
    [membershipsForSelectedTerm]
  );

  const activeMembershipCount = membershipsForSelectedTerm.filter((membership) => membership.status === "active").length;
  const endedMembershipCount = membershipsForSelectedTerm.filter((membership) => membership.status !== "active").length;

  const openCreateTerm = () => {
    setEditingTerm(null);
    setTermForm(createEmptyBoardTermForm());
    setShowTermModal(true);
  };

  const openEditTerm = (term) => {
    setEditingTerm(term);
    setTermForm({
      title: term.title || "",
      termNumber: term.termNumber ?? "",
      startDate: term.startDate || "",
      endDate: term.endDate || "",
      status: term.status || "planned",
      electionDate: term.electionDate || "",
      approvalDate: term.approvalDate || "",
      approvalRef: term.approvalRef || "",
      targetSeats: term.targetSeats ?? TARGET_BOARD_SIZE,
      notes: term.notes || "",
    });
    setShowTermModal(true);
  };

  const openCreateMembership = () => {
    if (!canManageMemberships) return;
    setEditingMembership(null);
    setMembershipForm(createEmptyBoardMembershipForm(selectedTerm.id));
    setShowMembershipModal(true);
  };

  const openEditMembership = (membership) => {
    setEditingMembership(membership);
    setMembershipForm({
      termId: membership.termId || selectedTerm?.id || "",
      memberId: membership.memberId || "",
      role: membership.role || BOARD_MEMBERSHIP_ROLES[0] || "",
      joinDate: membership.joinDate || "",
      endDate: membership.endDate || "",
      status: membership.status || "active",
      joinMethod: membership.joinMethod || "elected",
      endReason: membership.endReason || "",
      decisionDate: membership.decisionDate || "",
      decisionRef: membership.decisionRef || "",
      replacementForMembershipId: membership.replacementForMembershipId || "",
      escalationSourceMemberId: membership.escalationSourceMemberId || "",
      notes: membership.notes || "",
    });
    setShowMembershipModal(true);
  };

  const openReplacementMembership = (membership) => {
    if (!canManageMemberships || !membership?.id) return;
    const normalizedMembership = normalizeBoardMembership(membership);
    setEditingMembership(null);
    setMembershipForm({
      termId: normalizedMembership.termId || selectedTerm?.id || "",
      memberId: "",
      role: normalizedMembership.role || BOARD_MEMBERSHIP_ROLES[0] || "",
      joinDate: normalizedMembership.endDate || selectedTerm?.startDate || "",
      endDate: "",
      status: "active",
      joinMethod: "replacement",
      endReason: "",
      decisionDate: normalizedMembership.decisionDate || normalizedMembership.endDate || "",
      decisionRef: normalizedMembership.decisionRef || "",
      replacementForMembershipId: normalizedMembership.id,
      escalationSourceMemberId: normalizedMembership.memberId || "",
      notes: normalizedMembership.memberName
        ? `حل محل ${normalizedMembership.memberName} في مقعد ${normalizedMembership.role || "عضوية مجلس"}`
        : "",
    });
    setShowMembershipModal(true);
  };

  const saveTerm = async () => {
    if (!termForm.title.trim() || !termForm.startDate || !termForm.endDate) {
      alert("أدخل عنوان الدورة وتاريخ البداية والنهاية.");
      return;
    }

    setSavingTerm(true);
    try {
      const payload = normalizeBoardTerm({
        ...termForm,
        title: termForm.title.trim(),
        targetSeats: Number(termForm.targetSeats || TARGET_BOARD_SIZE),
      });

      if (payload.status === "active") {
        await Promise.all(
          normalizedTerms
            .filter((term) => term.id !== editingTerm?.id && term.status === "active")
            .map((term) =>
              updateDoc(doc(db, BOARD_TERMS_COLLECTION, term.id), {
                status: "closed",
                updatedAt: serverTimestamp(),
              })
            )
        );
      }

      if (editingTerm?.id) {
        await updateDoc(doc(db, BOARD_TERMS_COLLECTION, editingTerm.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        await logAuditEvent("board_term_updated", {
          termId: editingTerm.id,
          title: payload.title,
          status: payload.status,
        });
        setSelectedTermId(editingTerm.id);
      } else {
        const ref = await addDoc(collection(db, BOARD_TERMS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAuditEvent("board_term_created", {
          termId: ref.id,
          title: payload.title,
          status: payload.status,
        });
        setSelectedTermId(ref.id);
      }

      setShowTermModal(false);
      setEditingTerm(null);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingTerm(false);
    }
  };

  const saveMembership = async () => {
    if (!membershipForm.termId || !membershipForm.memberId || !membershipForm.role || !membershipForm.joinDate) {
      alert("اختر الدورة والعضو والصفة وتاريخ الالتحاق.");
      return;
    }

    const employee = allEmployees.find((item) => item.id === membershipForm.memberId);
    if (!employee) {
      alert("تعذر العثور على بيانات العضو المختار.");
      return;
    }

    setSavingMembership(true);
    try {
      const linkedMembership = membershipsMap.get(membershipForm.replacementForMembershipId) || null;
      const payload = normalizeBoardMembership({
        ...membershipForm,
        memberId: employee.id,
        memberName: employee.name || "",
        memberJobId: employee.jobId || "",
        replacementForMembershipId:
          membershipForm.joinMethod === "replacement" || membershipForm.joinMethod === "escalated"
            ? membershipForm.replacementForMembershipId
            : "",
        escalationSourceMemberId:
          membershipForm.joinMethod === "escalated"
            ? (membershipForm.escalationSourceMemberId || linkedMembership?.memberId || "")
            : membershipForm.joinMethod === "replacement"
              ? (linkedMembership?.memberId || membershipForm.escalationSourceMemberId || "")
              : "",
        roleOrder: BOARD_ROLE_ORDER[membershipForm.role] || 99,
        snapshot: buildBoardMembershipSnapshot({
          ...employee,
          membershipStatus: membershipForm.role,
          boardRoleTitle: membershipForm.role,
        }),
      });

      const conflictingActiveMembership = membershipsForSelectedTerm.find(
        (membership) =>
          membership.id !== editingMembership?.id &&
          membership.memberId === payload.memberId &&
          membership.status === "active" &&
          payload.status === "active"
      );
      if (conflictingActiveMembership) {
        alert("هذا العضو لديه بالفعل عضوية مجلس سارية داخل نفس الدورة.");
        setSavingMembership(false);
        return;
      }

      if (editingMembership?.id) {
        await updateDoc(doc(db, BOARD_MEMBERSHIPS_COLLECTION, editingMembership.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        await logAuditEvent("board_membership_updated", {
          membershipId: editingMembership.id,
          termId: payload.termId,
          memberId: payload.memberId,
          memberName: payload.memberName,
          role: payload.role,
          status: payload.status,
        });
      } else {
        const ref = await addDoc(collection(db, BOARD_MEMBERSHIPS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAuditEvent("board_membership_created", {
          membershipId: ref.id,
          termId: payload.termId,
          memberId: payload.memberId,
          memberName: payload.memberName,
          role: payload.role,
          status: payload.status,
        });
      }

      setShowMembershipModal(false);
      setEditingMembership(null);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingMembership(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      <Modal
        open={showTermModal}
        onClose={() => { if (!savingTerm) { setShowTermModal(false); setEditingTerm(null); } }}
        title={editingTerm ? "تعديل دورة المجلس" : "إضافة دورة مجلس"}
        actions={
          <>
            <button onClick={() => { setShowTermModal(false); setEditingTerm(null); }} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">إلغاء</button>
            <button onClick={saveTerm} disabled={savingTerm} className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center gap-1.5 disabled:opacity-60"><Save size={13} /> {savingTerm ? "جارٍ الحفظ..." : "حفظ الدورة"}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="عنوان الدورة" required>
            <input className={inputCls} value={termForm.title} onChange={(e)=>setTermForm((v)=>({...v,title:e.target.value}))} placeholder="مثال: دورة مجلس 2022 - 2027" />
          </FormField>
          <FormField label="رقم الدورة">
            <input className={inputCls} value={termForm.termNumber} onChange={(e)=>setTermForm((v)=>({...v,termNumber:e.target.value}))} placeholder="7" />
          </FormField>
          <FormField label="بداية الدورة" required>
            <ArabicDatePicker value={termForm.startDate} onChange={(value)=>setTermForm((v)=>({...v,startDate:value}))} />
          </FormField>
          <FormField label="نهاية الدورة" required>
            <ArabicDatePicker value={termForm.endDate} onChange={(value)=>setTermForm((v)=>({...v,endDate:value}))} />
          </FormField>
          <FormField label="حالة الدورة">
            <select className={inputCls} value={termForm.status} onChange={(e)=>setTermForm((v)=>({...v,status:e.target.value}))}>
              {TERM_STATUS_OPTIONS.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <FormField label="عدد المقاعد المستهدف">
            <input type="number" min="1" className={inputCls} value={termForm.targetSeats} onChange={(e)=>setTermForm((v)=>({...v,targetSeats:e.target.value}))} />
          </FormField>
          <FormField label="تاريخ الانتخاب">
            <ArabicDatePicker value={termForm.electionDate} onChange={(value)=>setTermForm((v)=>({...v,electionDate:value}))} />
          </FormField>
          <FormField label="تاريخ الاعتماد">
            <ArabicDatePicker value={termForm.approvalDate} onChange={(value)=>setTermForm((v)=>({...v,approvalDate:value}))} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="مرجع قرار الاعتماد">
              <input className={inputCls} value={termForm.approvalRef} onChange={(e)=>setTermForm((v)=>({...v,approvalRef:e.target.value}))} placeholder="قرار رقم 12/2022" />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="ملاحظات">
              <textarea className={clsx(inputCls, "resize-none")} rows={3} value={termForm.notes} onChange={(e)=>setTermForm((v)=>({...v,notes:e.target.value}))} />
            </FormField>
          </div>
        </div>
      </Modal>

      <Modal
        open={showMembershipModal}
        onClose={() => { if (!savingMembership) { setShowMembershipModal(false); setEditingMembership(null); } }}
        title={editingMembership ? "تعديل عضوية مجلس" : "إضافة عضوية مجلس"}
        actions={
          <>
            <button onClick={() => { setShowMembershipModal(false); setEditingMembership(null); }} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">إلغاء</button>
            <button onClick={saveMembership} disabled={savingMembership} className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center gap-1.5 disabled:opacity-60"><Save size={13} /> {savingMembership ? "جارٍ الحفظ..." : "حفظ العضوية"}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="الدورة" required>
            <select className={inputCls} value={membershipForm.termId} onChange={(e)=>setMembershipForm((v)=>({...v,termId:e.target.value}))}>
              <option value="">اختر الدورة</option>
              {normalizedTerms.map((term)=><option key={term.id} value={term.id}>{term.title || term.id}</option>)}
            </select>
          </FormField>
          <FormField label="العضو" required>
            <select className={inputCls} value={membershipForm.memberId} onChange={(e)=>setMembershipForm((v)=>({...v,memberId:e.target.value}))}>
              <option value="">اختر العضو</option>
              {selectableEmployees.map((employee)=><option key={employee.id} value={employee.id}>{employee.name || "بدون اسم"}{employee.jobId ? ` - ${employee.jobId}` : ""}</option>)}
            </select>
          </FormField>
          <FormField label="الصفة" required>
            <select className={inputCls} value={membershipForm.role} onChange={(e)=>setMembershipForm((v)=>({...v,role:e.target.value}))}>
              {BOARD_MEMBERSHIP_ROLES.map((role)=><option key={role} value={role}>{role}</option>)}
            </select>
          </FormField>
          <FormField label="طريقة الالتحاق">
            <select className={inputCls} value={membershipForm.joinMethod} onChange={(e)=>setMembershipForm((v)=>({...v,joinMethod:e.target.value}))}>
              {JOIN_METHOD_OPTIONS.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          {(membershipForm.joinMethod === "replacement" || membershipForm.joinMethod === "escalated") && (
            <FormField label={membershipForm.joinMethod === "escalated" ? "العضوية التي نتج عنها التصعيد" : "بديل عن العضوية"}>
              <select
                className={inputCls}
                value={membershipForm.replacementForMembershipId}
                onChange={(e)=>setMembershipForm((v)=>({...v,replacementForMembershipId:e.target.value}))}
              >
                <option value="">اختر العضوية المرتبطة</option>
                {replacementMembershipOptions
                  .filter((membership) => membership.id !== editingMembership?.id)
                  .map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      {(membership.memberName || "بدون اسم")} - {(membership.role || "عضوية")} {membership.endDate ? `- حتى ${membership.endDate}` : ""}
                    </option>
                  ))}
              </select>
            </FormField>
          )}
          {membershipForm.joinMethod === "escalated" && (
            <FormField label="صدر التصعيد بسبب خروج العضو">
              <select
                className={inputCls}
                value={membershipForm.escalationSourceMemberId}
                onChange={(e)=>setMembershipForm((v)=>({...v,escalationSourceMemberId:e.target.value}))}
              >
                <option value="">اختر العضو المرتبط</option>
                {replacementMembershipOptions.map((membership) => (
                  <option key={membership.id} value={membership.memberId}>
                    {(membership.memberName || "بدون اسم")} - {(membership.role || "عضوية")}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="تاريخ الالتحاق" required>
            <ArabicDatePicker value={membershipForm.joinDate} onChange={(value)=>setMembershipForm((v)=>({...v,joinDate:value}))} />
          </FormField>
          <FormField label="تاريخ الانتهاء">
            <ArabicDatePicker value={membershipForm.endDate} onChange={(value)=>setMembershipForm((v)=>({...v,endDate:value}))} />
          </FormField>
          <FormField label="حالة العضوية">
            <select className={inputCls} value={membershipForm.status} onChange={(e)=>setMembershipForm((v)=>({...v,status:e.target.value}))}>
              {MEMBERSHIP_STATUS_OPTIONS.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <FormField label="سبب الانتهاء">
            <select className={inputCls} value={membershipForm.endReason} onChange={(e)=>setMembershipForm((v)=>({...v,endReason:e.target.value}))}>
              {END_REASON_OPTIONS.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <FormField label="تاريخ القرار">
            <ArabicDatePicker value={membershipForm.decisionDate} onChange={(value)=>setMembershipForm((v)=>({...v,decisionDate:value}))} />
          </FormField>
          <FormField label="مرجع القرار">
            <input className={inputCls} value={membershipForm.decisionRef} onChange={(e)=>setMembershipForm((v)=>({...v,decisionRef:e.target.value}))} placeholder="محضر اجتماع أو قرار" />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="ملاحظات">
              <textarea className={clsx(inputCls, "resize-none")} rows={3} value={membershipForm.notes} onChange={(e)=>setMembershipForm((v)=>({...v,notes:e.target.value}))} />
            </FormField>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">الدورات والعضويات الزمنية</h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1">هذا التبويب ينقل المجلس من الحالة الحالية إلى سجلات زمنية قابلة للأرشفة والتتبع.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openCreateTerm} className="px-4 py-2 rounded-xl text-xs font-black bg-sky-500 text-white hover:bg-sky-600 transition-all flex items-center gap-1.5"><PlusCircle size={14}/> إضافة دورة</button>
          <button onClick={openCreateMembership} disabled={!canManageMemberships} className={clsx("px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5", canManageMemberships ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-slate-200 text-slate-400 cursor-not-allowed")}><Plus size={14}/> إضافة عضوية</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}><div className="text-[10px] font-black text-slate-400">إجمالي الدورات</div><div className="text-3xl font-black text-sky-600 mt-1">{normalizedTerms.length || 1}</div></div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}><div className="text-[10px] font-black text-slate-400">الدورة النشطة</div><div className="text-sm font-black text-amber-600 mt-2 truncate">{activeTerm?.title || "الدورة الحالية"}</div></div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}><div className="text-[10px] font-black text-slate-400">عضويات سارية</div><div className="text-3xl font-black text-emerald-600 mt-1">{activeMembershipCount}</div></div>
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}><div className="text-[10px] font-black text-slate-400">عضويات منتهية</div><div className="text-3xl font-black text-rose-500 mt-1">{endedMembershipCount}</div></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.4fr] gap-5">
        <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">الدورات المسجلة</h3>
            <span className="text-[10px] font-black text-slate-400">{normalizedTerms.length} دورة</span>
          </div>
          <div className="space-y-3">
            {normalizedTerms.length > 0 ? normalizedTerms.map((term) => {
              const activeCount = memberships.filter((membership) => membership.termId === term.id && membership.status === "active").length;
              const selected = term.id === selectedTerm?.id;
              return (
                <button key={term.id} onClick={() => setSelectedTermId(term.id)} className={clsx("w-full text-right p-4 rounded-2xl border transition-all", selected ? "border-amber-400 bg-amber-50/60 dark:bg-amber-900/10" : "border-slate-200 dark:border-slate-700 hover:border-amber-300")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">{term.title || "بدون عنوان"}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1">{term.startDate || "—"} إلى {term.endDate || "—"}</div>
                    </div>
                    <span className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-black border", chipClass(term.status === "active" ? "emerald" : term.status === "planned" ? "sky" : term.status === "archived" ? "slate" : "amber"))}>{TERM_STATUS_LABELS[term.status] || term.status}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[10px] font-black text-slate-500">
                    <span>{activeCount} عضوية سارية</span>
                    <span>{term.targetSeats || TARGET_BOARD_SIZE} مقعد</span>
                  </div>
                </button>
              );
            }) : <div className="p-4 rounded-2xl border border-dashed border-slate-300 text-center text-[11px] font-bold text-slate-400">لا توجد دورات مسجلة بعد. ابدأ بإضافة أول دورة.</div>}
          </div>
        </div>

        <div className="space-y-5">
          <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{selectedTerm?.title || "الدورة الحالية"}</h3>
                <div className="text-[11px] font-bold text-slate-400 mt-1">من {selectedTerm?.startDate || "—"} إلى {selectedTerm?.endDate || "—"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-black border", chipClass(selectedTerm?.status === "active" ? "emerald" : selectedTerm?.status === "planned" ? "sky" : "amber"))}>{TERM_STATUS_LABELS[selectedTerm?.status] || selectedTerm?.status || "انتقالية"}</span>
                {selectedTerm?.id && selectedTerm.id !== VIRTUAL_ACTIVE_TERM_ID && <button onClick={() => openEditTerm(selectedTerm)} className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all flex items-center gap-1"><Edit3 size={12}/> تعديل الدورة</button>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"><div className="text-[10px] font-black text-slate-400">تاريخ الانتخاب</div><div className="text-sm font-black text-slate-700 dark:text-slate-200 mt-1">{selectedTerm?.electionDate || "—"}</div></div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"><div className="text-[10px] font-black text-slate-400">تاريخ الاعتماد</div><div className="text-sm font-black text-slate-700 dark:text-slate-200 mt-1">{selectedTerm?.approvalDate || "—"}</div></div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"><div className="text-[10px] font-black text-slate-400">مرجع الاعتماد</div><div className="text-sm font-black text-slate-700 dark:text-slate-200 mt-1">{selectedTerm?.approvalRef || "—"}</div></div>
            </div>

            {selectedTerm?.notes && <div className="mt-4 p-3 rounded-xl bg-amber-50/40 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30"><div className="text-[10px] font-black text-amber-600 mb-1">ملاحظات</div><div className="text-xs font-bold text-slate-600 dark:text-slate-300">{selectedTerm.notes}</div></div>}
          </div>

          <div className={clsx("p-5 rounded-2xl border shadow-sm", T.card)}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">عضويات المجلس داخل الدورة</h3>
                <div className="text-[11px] font-bold text-slate-400 mt-1">كل عضوية تحمل تاريخ التحاق وانتهاء وسبب وطريقة الالتحاق.</div>
              </div>
              <button onClick={openCreateMembership} disabled={!canManageMemberships} className={clsx("px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1", canManageMemberships ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-slate-200 text-slate-400 cursor-not-allowed")}><Plus size={12}/> إضافة عضوية</button>
            </div>

            <div className="space-y-3">
              {membershipViews.length > 0 ? membershipViews.map((member, index) => {
                const membership = member.boardMembership || {};
                const linkedMembership = membershipsMap.get(membership.replacementForMembershipId);
                const linkedEmployee = employeesMap.get(membership.escalationSourceMemberId);
                return (
                  <div key={membership.id || member.id || index} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar member={member} idx={index} />
                        <div className="min-w-0">
                          <button onClick={() => member.id && openEmployeeModal?.(member.id)} className="text-sm font-black text-slate-800 dark:text-slate-100 hover:text-amber-600 truncate">{member.name || "بدون اسم"}</button>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">{member.jobId || "بدون كود"}{member.workplace ? ` • ${member.workplace}` : ""}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-black border", chipClass("sky"))}>{membership.role || "—"}</span>
                        <span className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-black border", chipClass(membership.status === "active" ? "emerald" : membership.status === "vacated" ? "rose" : "amber"))}>{MEMBERSHIP_STATUS_LABELS[membership.status] || membership.status || "—"}</span>
                        <button onClick={() => openEditMembership(membership)} className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300 transition-all flex items-center gap-1"><Edit3 size={11}/> تعديل</button>
                        {membership.status !== "active" && canManageMemberships && (
                          <button onClick={() => openReplacementMembership(membership)} className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-teal-200 dark:border-teal-800 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all flex items-center gap-1">
                            <Plus size={11}/> بديل/تصعيد
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 text-[10px] font-black">
                      <div className="text-slate-500">التحاق: <span className="text-slate-700 dark:text-slate-200">{membership.joinDate || "—"}</span></div>
                      <div className="text-slate-500">انتهاء: <span className="text-slate-700 dark:text-slate-200">{membership.endDate || "—"}</span></div>
                      <div className="text-slate-500">الطريقة: <span className="text-slate-700 dark:text-slate-200">{JOIN_METHOD_LABELS[membership.joinMethod] || membership.joinMethod || "—"}</span></div>
                      <div className="text-slate-500">السبب: <span className="text-slate-700 dark:text-slate-200">{END_REASON_LABELS[membership.endReason] || membership.endReason || "—"}</span></div>
                    </div>
                    {membership.decisionRef && <div className="text-[10px] font-bold text-slate-400 mt-3">مرجع القرار: {membership.decisionRef}</div>}
                    {(linkedMembership || linkedEmployee) && (
                      <div className="mt-3 text-[10px] font-bold text-slate-400 flex flex-wrap gap-4">
                        {linkedMembership && (
                          <span>
                            {membership.joinMethod === "escalated" ? "التصعيد مرتبط بعضوية:" : "بديل عن:"}{" "}
                            <span className="text-slate-600 dark:text-slate-300">{linkedMembership.memberName || "—"} - {linkedMembership.role || "عضوية"}</span>
                          </span>
                        )}
                        {membership.joinMethod === "escalated" && linkedEmployee && (
                          <span>
                            بسبب خروج: <span className="text-slate-600 dark:text-slate-300">{linkedEmployee.name || "—"}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : <div className="p-5 rounded-2xl border border-dashed border-slate-300 text-center text-[11px] font-bold text-slate-400">{canManageMemberships ? "لا توجد عضويات مسجلة لهذه الدورة بعد." : "أنشئ دورة حقيقية أولًا ثم أضف العضويات."}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

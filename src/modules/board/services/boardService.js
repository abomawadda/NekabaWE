import {
  addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { logAuditEvent } from "../../utils/auditLog";
import {
  BOARD_MEETINGS_COLLECTION,
  BOARD_MEMBERSHIPS_COLLECTION,
  BOARD_TERMS_COLLECTION,
} from "../boardLifecycle";

export async function saveBoardMeeting(meeting) {
  const { id, ...data } = meeting;
  try {
    if (id) {
      await updateDoc(doc(db, BOARD_MEETINGS_COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
      await logAuditEvent("board_meeting_updated", { meetingId: id, title: data.title || "" });
      return id;
    }
    const ref = await addDoc(collection(db, BOARD_MEETINGS_COLLECTION), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await logAuditEvent("board_meeting_created", { meetingId: ref.id, title: data.title || "" });
    return ref.id;
  } catch (e) {
    console.error("boardService.saveBoardMeeting:", e);
    throw e;
  }
}

export async function deleteBoardMeeting(id, meta = {}) {
  try {
    await deleteDoc(doc(db, BOARD_MEETINGS_COLLECTION, id));
    await logAuditEvent("board_meeting_deleted", { meetingId: id, ...meta });
  } catch (e) {
    console.error("boardService.deleteBoardMeeting:", e);
    throw e;
  }
}

export async function updateMeetingAttendance(meetingId, attendancePayload) {
  try {
    await updateDoc(doc(db, BOARD_MEETINGS_COLLECTION, meetingId), attendancePayload);
  } catch (e) {
    console.error("boardService.updateMeetingAttendance:", e);
    throw e;
  }
}

export async function updateMeetingDecisions(meetingId, decisions) {
  try {
    await updateDoc(doc(db, BOARD_MEETINGS_COLLECTION, meetingId), { decisions });
  } catch (e) {
    console.error("boardService.updateMeetingDecisions:", e);
    throw e;
  }
}

export async function saveBoardTerm(term) {
  const { id, ...data } = term;
  try {
    if (id) {
      await updateDoc(doc(db, BOARD_TERMS_COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
      return id;
    }
    const ref = await addDoc(collection(db, BOARD_TERMS_COLLECTION), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.error("boardService.saveBoardTerm:", e);
    throw e;
  }
}

export async function deleteBoardTerm(id) {
  try {
    await deleteDoc(doc(db, BOARD_TERMS_COLLECTION, id));
    await logAuditEvent("board_term_deleted", { termId: id });
  } catch (e) {
    console.error("boardService.deleteBoardTerm:", e);
    throw e;
  }
}

export async function saveBoardMembership(membership) {
  const { id, ...data } = membership;
  try {
    if (id) {
      await updateDoc(doc(db, BOARD_MEMBERSHIPS_COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
      return id;
    }
    const ref = await addDoc(collection(db, BOARD_MEMBERSHIPS_COLLECTION), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.error("boardService.saveBoardMembership:", e);
    throw e;
  }
}

export async function deleteBoardMembership(id) {
  try {
    await deleteDoc(doc(db, BOARD_MEMBERSHIPS_COLLECTION, id));
    await logAuditEvent("board_membership_deleted", { membershipId: id });
  } catch (e) {
    console.error("boardService.deleteBoardMembership:", e);
    throw e;
  }
}

export async function syncEmployeeLifecycle(employee, updates) {
  try {
    await updateDoc(doc(db, "employees", employee.id), updates);
  } catch (e) {
    console.error("boardService.syncEmployeeLifecycle:", e);
    throw e;
  }
}

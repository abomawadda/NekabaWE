import {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { useFirebase } from "../../../app/providers/FirebaseProvider";
import { logAuditEvent } from "../../../utils/auditLog";
import {
  buildEmployeeLifecyclePatch,
  buildMemberMovementTimeline,
  buildMovementAfterSnapshot,
  normalizeMemberMovement,
} from "../helpers/memberMovements";

const EMPLOYEES_COLLECTION = "employees";
const MEMBER_MOVEMENTS_COLLECTION = "member_movements";

export function useMemberMovementService() {
  const { app } = useFirebase();
  const db = getFirestore(app);

  const getEmployeeById = async (employeeId) => {
    if (!employeeId) return null;
    const employeeSnap = await getDoc(doc(db, EMPLOYEES_COLLECTION, employeeId));
    return employeeSnap.exists() ? { id: employeeSnap.id, ...employeeSnap.data() } : null;
  };

  const saveMemberMovement = async (movement, member) => {
    const movementId = movement?.id || doc(collection(db, MEMBER_MOVEMENTS_COLLECTION)).id;
    const normalized = normalizeMemberMovement(movement, member, {
      id: movementId,
      updatedAt: new Date().toISOString(),
      createdAt: movement?.createdAt || new Date().toISOString(),
    });

    await setDoc(
      doc(db, MEMBER_MOVEMENTS_COLLECTION, movementId),
      {
        ...normalized,
        createdAtServer: movement?.createdAtServer || serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      },
      { merge: true }
    );

    await logAuditEvent("employees.movement.save", {
      targetId: movementId,
      after: {
        memberId: normalized.memberId,
        movementType: normalized.movementType,
        effectiveDate: normalized.effectiveDate,
        status: normalized.status,
      },
      riskLevel: "medium",
      page: "/employees",
    });

    return normalized;
  };

  const approveMemberMovement = async (movement, member) => {
    const resolvedMember = member || (await getEmployeeById(movement?.memberId));
    if (!resolvedMember?.id) {
      throw new Error("تعذر العثور على العضو المطلوب لاعتماد الحركة.");
    }

    const movementId = movement?.id || doc(collection(db, MEMBER_MOVEMENTS_COLLECTION)).id;
    const approvedMovement = normalizeMemberMovement(movement, resolvedMember, {
      id: movementId,
      status: "approved",
      updatedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    });
    const employeePatch = buildEmployeeLifecyclePatch(resolvedMember, approvedMovement);
    const afterSnapshot = buildMovementAfterSnapshot(resolvedMember, approvedMovement);
    const batch = writeBatch(db);

    batch.set(
      doc(db, MEMBER_MOVEMENTS_COLLECTION, movementId),
      {
        ...approvedMovement,
        afterSnapshot,
        createdAtServer: approvedMovement?.createdAtServer || serverTimestamp(),
        updatedAtServer: serverTimestamp(),
        approvedAtServer: serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      doc(db, EMPLOYEES_COLLECTION, resolvedMember.id),
      {
        ...employeePatch,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();

    await logAuditEvent("employees.movement.approve", {
      targetId: movementId,
      before: approvedMovement.beforeSnapshot || null,
      after: afterSnapshot,
      riskLevel: "high",
      page: "/employees",
    });

    return {
      movement: approvedMovement,
      employeePatch,
    };
  };

  const createAndApplyMemberMovement = async (movement, member) => {
    const draft = await saveMemberMovement(
      {
        ...movement,
        status: movement?.status || "draft",
      },
      member
    );
    return approveMemberMovement(draft, member);
  };

  const buildServiceEndMovement = ({ reason = "", notes = "", effectiveDate = "", decisionDate = "" } = {}, member) =>
    normalizeMemberMovement(
      {
        movementType: "service_end",
        reason,
        notes,
        effectiveDate,
        decisionDate,
        source: "employee_module",
      },
      member
    );

  const normalizeMovementFeed = (movements = []) => buildMemberMovementTimeline(movements);

  return {
    getEmployeeById,
    saveMemberMovement,
    approveMemberMovement,
    createAndApplyMemberMovement,
    buildServiceEndMovement,
    normalizeMovementFeed,
  };
}

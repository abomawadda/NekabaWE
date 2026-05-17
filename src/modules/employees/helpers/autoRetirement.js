import {
  collection, doc, getDocs, query, where, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../app/providers/FirebaseProvider";
import { logAuditEvent } from "../../../utils/auditLog";
import { normalizeMemberMovement, buildEmployeeLifecyclePatch, buildMovementAfterSnapshot } from "./memberMovements";

const RETIREMENT_AGE = 60;

const calcAge = (birthDateStr) => {
  if (!birthDateStr) return null;
  const [d, m, y] = birthDateStr.split("/").map(Number);
  if (!y) return null;
  const birth = new Date(y, m - 1, d);
  if (isNaN(birth)) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

export async function processAutoRetirements(employees) {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = (employees || []).filter((emp) => {
    if (emp.memberState === "معاش") return false;
    const age = calcAge(emp.birthDate || emp.dateOfBirth);
    return age !== null && age >= RETIREMENT_AGE;
  });

  if (!candidates.length) return { retired: 0, names: [] };

  for (const emp of candidates) {
    try {
      const movementId = doc(collection(db, "member_movements")).id;
      const movement = normalizeMemberMovement(
        {
          id: movementId,
          movementType: "retirement",
          status: "draft",
          reason: "إحالة للمعاش لبلوغ السن القانونية (تلقائي)",
          effectiveDate: today,
          decisionDate: today,
          source: "employee_module",
        },
        emp
      );

      const employeePatch = buildEmployeeLifecyclePatch(emp, movement);
      const afterSnapshot = buildMovementAfterSnapshot(emp, movement);
      const batch = writeBatch(db);

      batch.set(
        doc(db, "member_movements", movementId),
        {
          ...movement,
          status: "approved",
          afterSnapshot,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
          approvedAtServer: serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        doc(db, "employees", emp.id),
        {
          ...employeePatch,
          lastMovementType: movement.movementType,
          lastMovementDate: today,
          autoRetiredAt: today,
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      await logAuditEvent("employees.auto_retire", {
        targetId: emp.id,
        after: { name: emp.name, jobId: emp.jobId, memberState: "معاش", retirementDate: today },
        riskLevel: "high",
      });
    } catch (err) {
      console.error(`فشل الإحالة التلقائية للمعاش للعضو ${emp.name}:`, err);
    }
  }

  return {
    retired: candidates.length,
    names: candidates.map((e) => e.name),
  };
}

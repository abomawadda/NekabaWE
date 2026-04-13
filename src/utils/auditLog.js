import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../app/providers/FirebaseProvider";

export async function logAuditEvent(action, details = {}) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      action,
      details,
      createdAt: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    });
  } catch (error) {
    console.error("audit_logs:", error);
  }
}

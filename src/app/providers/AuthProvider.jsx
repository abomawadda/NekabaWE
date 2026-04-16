import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "./FirebaseProvider";

const SESSION_KEY = "nekaba_user_session_v1";
const ADMIN_CREDENTIALS = {
  username: "محمود العراقي",
  password: "Mawadda2030*#",
  displayName: "محمود العراقي",
  role: "admin",
  title: "مسؤول النظام",
  membershipStatus: "أمين الصندوق",
};

const AuthContext = createContext(null);

const normalizeDigits = (value = "") =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/\D/g, "");

const normalizeText = (value = "") => String(value || "").trim();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession) {
        setUser(JSON.parse(savedSession));
      }
    } catch (error) {
      console.error("تعذر قراءة جلسة المستخدم:", error);
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const persistUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
  };

  const loginAdmin = async ({ username, password }) => {
    const normalizedUsername = normalizeText(username);
    const normalizedPassword = String(password || "");

    if (
      normalizedUsername !== ADMIN_CREDENTIALS.username ||
      normalizedPassword !== ADMIN_CREDENTIALS.password
    ) {
      throw new Error("بيانات مسؤول النظام غير صحيحة");
    }

    persistUser({
      id: "system-admin",
      role: ADMIN_CREDENTIALS.role,
      displayName: ADMIN_CREDENTIALS.displayName,
      title: ADMIN_CREDENTIALS.title,
      membershipStatus: ADMIN_CREDENTIALS.membershipStatus,
      loginMode: "admin",
    });
  };

  const loginEmployee = async ({ jobId, phone, nationalIdLast4 }) => {
    const normalizedJobId = normalizeDigits(jobId);
    const normalizedPhone = normalizeDigits(phone);
    const normalizedNationalIdLast4 = normalizeDigits(nationalIdLast4).slice(-4);

    if (!normalizedJobId || !normalizedPhone || normalizedNationalIdLast4.length !== 4) {
      throw new Error("برجاء استكمال بيانات الدخول الثلاثة بشكل صحيح");
    }

    const snapshot = await getDocs(query(collection(db, "employees")));
    const employees = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const matchedEmployee = employees.find((employee) => {
      const employeeJobId = normalizeDigits(employee.jobId);
      const employeePhone = normalizeDigits(employee.phone);
      const employeeNationalId = normalizeDigits(employee.nationalId);

      return (
        employeeJobId === normalizedJobId &&
        employeePhone === normalizedPhone &&
        employeeNationalId.slice(-4) === normalizedNationalIdLast4
      );
    });

    if (!matchedEmployee) {
      throw new Error("تعذر مطابقة بيانات الدخول مع سجلات الأعضاء");
    }

    persistUser({
      id: matchedEmployee.id,
      employeeId: matchedEmployee.jobId || matchedEmployee.id,
      role: "viewer",
      displayName: matchedEmployee.name || "عضو",
      title: "مشاهدة فقط",
      membershipStatus: matchedEmployee.membershipStatus || "عضو",
      phone: matchedEmployee.phone || "",
      loginMode: "employee",
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      isReadOnly: Boolean(user) && user?.role !== "admin",
      userRole: user?.role === "admin" ? "treasurer" : "viewer",
      loginAdmin,
      loginEmployee,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

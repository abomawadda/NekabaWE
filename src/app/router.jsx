import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import { useAuth } from "./providers/AuthProvider";
import { PERMISSIONS } from "../security/permissions";
import ProtectedRoute from "../security/ProtectedRoute";

import DashboardPage from "../modules/dashboard/DashboardPage";
import EmployeesPage from "../modules/employees/EmployeesPage";
import TreasuryPage from "../modules/treasury/TreasuryPage";
import TreasuryLedger from "../modules/treasury/TreasuryLedger";
import SettlementTab from "../modules/settlements/SettlementTab";
import BoardDashboard from "../modules/board/BoardDashboard";
import EventsMaster from "../modules/activities/EventsMaster";
import EventBookings from "../modules/activities/EventBookings";
import DataImporter from "../modules/settings/DataImporter";
import ReportBuilder from "../modules/reports/ReportBuilder";
import LoginPage from "../modules/auth/LoginPage";
import RegistrationPage from "../modules/auth/RegistrationPage";
import SecurityCenter from "../modules/security/SecurityCenter";
import MemberPortal from "../modules/portal/MemberPortal";

function NotFoundPage() {
  return (
    <div className="p-20 flex flex-col items-center justify-center min-h-screen text-slate-400" dir="rtl">
      <h1 className="text-4xl font-black mb-2">404</h1>
      <p className="text-sm font-bold">الصفحة غير موجودة</p>
    </div>
  );
}

function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-20 flex items-center justify-center min-h-screen text-slate-400 font-black" dir="rtl">
        جارٍ تحميل الجلسة الآمنة...
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboardpage" replace /> : children;
}

export default function Router() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegistrationPage />
          </PublicOnly>
        }
      />

      <Route path="/member-portal" element={<MemberPortal />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboardpage" element={<DashboardPage />} />
        <Route path="/dashboard" element={<Navigate to="/dashboardpage" replace />} />
        <Route path="/home" element={<Navigate to="/dashboardpage" replace />} />

        <Route
          path="/employees"
          element={
            <ProtectedRoute permission={PERMISSIONS.employeesView}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees/:employeeId"
          element={
            <ProtectedRoute permission={PERMISSIONS.employeesView}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/board"
          element={
            <ProtectedRoute permission={PERMISSIONS.boardView}>
              <BoardDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/activities" element={<Navigate to="/activities/master" replace />} />
        <Route
          path="/activities/master"
          element={
            <ProtectedRoute permission={PERMISSIONS.activitiesView}>
              <EventsMaster />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activities/bookings"
          element={
            <ProtectedRoute permission={PERMISSIONS.activitiesView}>
              <EventBookings />
            </ProtectedRoute>
          }
        />

        <Route path="/treasury" element={<Navigate to="/treasury/admin" replace />} />
        <Route
          path="/treasury/admin"
          element={
            <ProtectedRoute permission={PERMISSIONS.treasuryView}>
              <TreasuryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/treasury/ledger"
          element={
            <ProtectedRoute permission={PERMISSIONS.treasuryView}>
              <TreasuryLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/treasury/settlements"
          element={
            <ProtectedRoute permission={PERMISSIONS.treasuryView}>
              <SettlementTab />
            </ProtectedRoute>
          }
        />

        <Route path="/settings" element={<Navigate to="/importer" replace />} />
        <Route
          path="/importer"
          element={
            <ProtectedRoute permission={PERMISSIONS.settingsImport}>
              <DataImporter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute permission={PERMISSIONS.reportsView}>
              <ReportBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security"
          element={
            <ProtectedRoute permission={PERMISSIONS.securityView}>
              <SecurityCenter />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

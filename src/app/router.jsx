import { Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";

// 🎯 استيراد الشاشات الأساسية
import DashboardPage from "../modules/dashboard/DashboardPage";
import EmployeesPage from "../modules/employees/EmployeeDashboard";
import TreasuryPage from "../modules/treasury/TreasuryPage";
import TreasuryLedger from "../modules/treasury/TreasuryLedger";
import SettlementTab from "../modules/settlements/SettlementTab";
import BoardDashboard from "../modules/board/BoardDashboard"; 

// 🎯 استيراد شاشات الأنشطة والفعاليات الجديدة
import EventsMaster from "../modules/activities/EventsMaster";
import EventBookings from "../modules/activities/EventBookings";

export default function Router() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        
        {/* 🎯 الصفحة الرئيسية */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboardpage" element={<DashboardPage />} />

        {/* ── مسار الموظفين والأعضاء ── */}
        <Route path="/employees" element={<EmployeesPage />} />

        {/* ── مسار مجلس الإدارة ── */}
        <Route path="/board" element={<BoardDashboard />} />

        {/* ── 🏕️ مسارات الأنشطة والفعاليات ── */}
        <Route path="/activities/master" element={<EventsMaster />} />
        <Route path="/activities/bookings" element={<EventBookings />} />

        {/* ── 💰 مسارات الخزينة ── */}
        <Route path="/treasury/admin" element={<TreasuryPage />} />
        <Route path="/treasury/ledger" element={<TreasuryLedger />} />
        <Route path="/treasury/settlements" element={<SettlementTab />} />
        
      </Route>

      {/* ── شاشة 404 (في حال إدخال مسار خاطئ) ── */}
      <Route path="*" element={<div className="p-20 text-center font-black">404 - الصفحة غير موجودة</div>} />
    </Routes>
  );
}
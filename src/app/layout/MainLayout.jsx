import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import HeaderAuth from "./HeaderAuth";
import { useAuth } from "../providers/AuthProvider";

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isReadOnly, sessionIntegrity } = useAuth();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950" dir="rtl">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        <HeaderAuth toggleSidebar={() => setIsMobileMenuOpen(true)} />

        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 w-full relative"
          data-readonly={isReadOnly ? "true" : "false"}
        >
          {sessionIntegrity.reason && !sessionIntegrity.valid && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
              تم إنهاء الجلسة السابقة بسبب: {sessionIntegrity.reason}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

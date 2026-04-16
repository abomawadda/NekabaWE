import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import HeaderAuth from "./HeaderAuth";
import { useAuth } from "../providers/AuthProvider";

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isReadOnly } = useAuth();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    // 🎯 تم إزالة font-sans ليعمل خطك الأصلي
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}

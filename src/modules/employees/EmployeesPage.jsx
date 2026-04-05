import React, { useState } from "react";
import EmployeeDashboard from "./EmployeeDashboard";
import EmployeeForm from "./EmployeeForm";
import EmployeeCard from "./EmployeeCard"; // 👈 استدعاء شاشة العرض الجديدة

export default function EmployeesPage() {
  // حالة التحكم في الشاشة: "dashboard" | "form" | "card"
  const [currentView, setCurrentView] = useState("dashboard");
  // تخزين الموظف المحدد عند التعديل أو العرض
  const [selectedEmp, setSelectedEmp] = useState(null);

  return (
    <div className="w-full">
      {currentView === "dashboard" && (
        <EmployeeDashboard 
          onAddNew={() => { 
            setSelectedEmp(null); // تفريغ البيانات لموظف جديد
            setCurrentView("form"); 
          }} 
          onEditMember={(emp) => { 
            setSelectedEmp(emp); 
            setCurrentView("form"); 
          }}
          onViewMember={(emp) => { 
            setSelectedEmp(emp);
            setCurrentView("card"); // 👈 الانتقال إلى شاشة الـ Card
          }}
        />
      )}

      {currentView === "form" && (
        <EmployeeForm 
          initial={selectedEmp} 
          onSubmit={() => setCurrentView("dashboard")} // عند الحفظ نعود للوحة
          onCancel={() => setCurrentView("dashboard")} // عند الإلغاء نعود للوحة
        />
      )}

      {currentView === "card" && (
        <EmployeeCard 
          employee={selectedEmp}
          onBack={() => setCurrentView("dashboard")}
          onEdit={(emp) => {
             setSelectedEmp(emp);
             setCurrentView("form"); // الانتقال للتعديل من داخل البروفايل
          }}
        />
      )}
    </div>
  );
}
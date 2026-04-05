import React from "react";
import { BrowserRouter } from "react-router-dom";
import Router from "./router";
import { ThemeProvider } from "./providers/ThemeProvider";
import { FirebaseProvider } from "./providers/FirebaseProvider";
import { AlertProvider } from "./providers/AlertProvider";

// 🎯 استيراد المزود العالمي الجديد للبطاقة المنبثقة
import { GlobalEmployeeModalProvider } from "./providers/GlobalEmployeeModal";

export default function App() {
  return (
    <ThemeProvider>
      <FirebaseProvider>
        <AlertProvider>
          
          {/* 🎯 تغليف التطبيق بالمزود العالمي هنا */}
          <GlobalEmployeeModalProvider>
            <BrowserRouter>
              {/* الراوتر الذي يحتوي على MainLayout والسايد بار */}
              <Router /> 
            </BrowserRouter>
          </GlobalEmployeeModalProvider>

        </AlertProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
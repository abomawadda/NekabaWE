import React from "react";
import { BrowserRouter } from "react-router-dom";
import Router from "./router";
import { ThemeProvider } from "./providers/ThemeProvider";
import { FirebaseProvider } from "./providers/FirebaseProvider";
import { AlertProvider } from "./providers/AlertProvider";
import { AuthProvider } from "./providers/AuthProvider";
import ArabicTextRepairProvider from "./providers/ArabicTextRepairProvider";
import LogoBanner from "../ui/LogoBanner";

// 🎯 استيراد المزود العالمي الجديد للبطاقة المنبثقة
import { GlobalEmployeeModalProvider } from "./providers/GlobalEmployeeModal";

export default function App() {
  return (
    <ThemeProvider>
      <FirebaseProvider>
        <AlertProvider>
          {/* 🎯 Logo Banner at the top */}
          <LogoBanner />
          
          {/* 🎯 تغليف التطبيق بالمزود العالمي هنا */}
          <AuthProvider>
            <BrowserRouter>
              <ArabicTextRepairProvider>
                <GlobalEmployeeModalProvider>
              {/* الراوتر الذي يحتوي على MainLayout والسايد بار */}
                  <Router /> 
                </GlobalEmployeeModalProvider>
              </ArabicTextRepairProvider>
            </BrowserRouter>
          </AuthProvider>

        </AlertProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}

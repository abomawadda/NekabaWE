import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx"; 
import "./index.css";

window.onerror = (msg, url, line, col, err) => {
  document.body.innerHTML = `<div dir="rtl" style="padding:40px;font-family:sans-serif;background:#fff1f1;color:#c00;min-height:100vh">
    <h2 style="margin:0 0 10px">خطأ غير متوقع</h2>
    <pre style="background:#fff;padding:16px;border-radius:8px;border:1px solid #fcc;font-size:13px;white-space:pre-wrap">${msg}\n\nالملف: ${url}\nالسطر: ${line}\n\n${err?.stack || ""}</pre>
  </div>`;
  return true;
};

window.addEventListener("unhandledrejection", (e) => {
  document.body.innerHTML = `<div dir="rtl" style="padding:40px;font-family:sans-serif;background:#fff1f1;color:#c00;min-height:100vh">
    <h2 style="margin:0 0 10px">خطأ غير معالج (Promise)</h2>
    <pre style="background:#fff;padding:16px;border-radius:8px;border:1px solid #fcc;font-size:13px;white-space:pre-wrap">${e.reason?.message || e.reason}\n\n${e.reason?.stack || ""}</pre>
  </div>`;
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
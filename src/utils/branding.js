export const ORG_REPORT_TITLE = "النقابة العامة للعاملين بالاتصالات بالدقهلية";
export const ORG_REPORT_SUBTITLE = "أمانة الصندوق";
export const ORG_RIGHT_LOGO_URL = "/brand-right.webp";
export const ORG_LEFT_LOGO_URL = "/brand-left.png";

export const getReportTitleHtml = () =>
  `${ORG_REPORT_TITLE}<br/><span style="font-size:.72em; color:#0f766e;">${ORG_REPORT_SUBTITLE}</span>`;

export const getPrintBrandStyles = () => `
.brand-header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #0f766e;padding-bottom:14px;margin-bottom:18px}
.brand-logo-wrap{width:74px;display:flex;justify-content:center;align-items:center;flex:0 0 74px}
.brand-logo{width:62px;height:62px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(15,118,110,.15))}
.brand-center{flex:1;text-align:center}
.brand-title{font-size:22px;font-weight:900;color:#0f172a;line-height:1.35}
.brand-subtitle{font-size:13px;font-weight:800;color:#0f766e;margin-top:4px}
`;

export const getPrintBrandHeader = ({ reportTitle = "", reportMeta = "" } = {}) => `
  <div class="brand-header">
    <div class="brand-logo-wrap"><img src="${ORG_RIGHT_LOGO_URL}" alt="logo-right" class="brand-logo"/></div>
    <div class="brand-center">
      <div class="brand-title">${ORG_REPORT_TITLE}</div>
      <div class="brand-subtitle">${ORG_REPORT_SUBTITLE}</div>
      ${reportTitle ? `<div style="font-size:18px;font-weight:900;color:#0f766e;margin-top:8px">${reportTitle}</div>` : ""}
      ${reportMeta ? `<div style="font-size:11px;color:#64748b;font-weight:700;margin-top:6px">${reportMeta}</div>` : ""}
    </div>
    <div class="brand-logo-wrap"><img src="${ORG_LEFT_LOGO_URL}" alt="logo-left" class="brand-logo"/></div>
  </div>
`;

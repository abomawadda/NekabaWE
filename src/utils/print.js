export const openPrintWindow = (title = "print", features = "width=1200,height=900") => {
  const win = window.open("", "_blank", features);
  if (!win) {
    window.alert("يرجى السماح بالنوافذ المنبثقة حتى تعمل الطباعة.");
    return null;
  }

  try {
    win.document.title = title;
  } catch {
    // no-op
  }

  return win;
};

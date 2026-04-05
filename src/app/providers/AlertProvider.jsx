import { createContext, useContext } from 'react';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  // هنا يمكنك لاحقاً إضافة منطق إشعارات النجاح والخطأ
  return (
    <AlertContext.Provider value={{}}>
      {children}
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);
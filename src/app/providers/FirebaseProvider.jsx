import React, { createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const FirebaseContext = createContext(null);

const firebaseConfig = {
  apiKey: "AIzaSyDZjHYgoQRSto9-Sb1nEVeWkDgD0G4NWTw",
  authDomain: "nekaba2026.firebaseapp.com",
  projectId: "nekaba2026",
  storageBucket: "nekaba2026.firebasestorage.app",
  messagingSenderId: "605500549585",
  appId: "1:605500549585:web:307bd9ca2fb21f96f218f0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export function FirebaseProvider({ children }) {
  return (
    <FirebaseContext.Provider value={{ app, db, storage }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// أداة الاستدعاء
export const useFirebase = () => useContext(FirebaseContext);
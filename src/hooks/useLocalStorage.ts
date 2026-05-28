import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Sync from Firestore on mount if logged in
  useEffect(() => {
    const fetchFromFirestore = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid, "appData", key);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.value !== undefined) {
              setStoredValue(data.value);
              window.localStorage.setItem(key, JSON.stringify(data.value));
            }
          }
        } catch (e: any) {
          if (e?.code === 'unavailable' || e?.message?.toLowerCase().includes('offline')) {
            console.log(`Offline mode: using local storage for ${key}`);
          } else {
            console.error(`Error pulling ${key} from Firestore`, e);
          }
        }
      }
    };

    // We can use an auth state observer to sync when logged in
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchFromFirestore();
      }
    });

    return () => unsubscribe();
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((current) => {
        const valueToStore = value instanceof Function ? value(current) : value;

        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }

        // Async sync to Firestore
        const user = auth.currentUser;
        if (user) {
          const docRef = doc(db, "users", user.uid, "appData", key);
          setDoc(docRef, { value: valueToStore }, { merge: true }).catch((e: any) => {
            if (e?.code === 'unavailable' || e?.message?.toLowerCase().includes('offline')) {
              // Silently handle offline set, it will sync later if persistence is enabled
            } else {
              console.error(`Error syncing ${key} to Firestore`, e);
            }
          });
        }

        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}

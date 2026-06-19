import { useState, useEffect, useCallback, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Global map to hold timeout IDs for debouncing writes to Firestore per key
const writeKeysDebounceMap = new Map<string, NodeJS.Timeout>();

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

  const latestValue = useRef(storedValue);
  latestValue.current = storedValue;

  // Sync from Firestore on mount if logged in
  useEffect(() => {
    const fetchFromFirestore = async () => {
      // Do not sync googleAuthToken from Firestore because it's a short-lived token
      // and fetching it can overwrite a newly issued token upon login.
      if (key === "googleAuthToken") return;
      
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
          } else if (e?.message?.includes("Missing or insufficient permissions")) {
            console.warn(`Permission denied pulling ${key} from Firestore (Check rules)`);
          } else {
            console.error(`Error pulling ${key} from Firestore`, e);
          }
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchFromFirestore();
      }
    });

    const handleStorageChange = (e: CustomEvent | StorageEvent) => {
      if ('detail' in e) {
        if (e.detail.key === key) {
          setStoredValue(e.detail.newValue);
        }
      } else if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener('local-storage', handleStorageChange as EventListener);
    window.addEventListener('storage', handleStorageChange as EventListener);

    return () => {
      unsubscribe();
      window.removeEventListener('local-storage', handleStorageChange as EventListener);
      window.removeEventListener('storage', handleStorageChange as EventListener);
    };
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(latestValue.current) : value;
      
      setStoredValue(valueToStore);
      latestValue.current = valueToStore;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, newValue: valueToStore } }));
        }, 0);
      }

      // Async sync to Firestore with Debounce (prevent resource exhaustion)
      if (key === "googleAuthToken") return;
      
      const user = auth.currentUser;
      if (user) {
        if (writeKeysDebounceMap.has(key)) {
          clearTimeout(writeKeysDebounceMap.get(key)!);
        }

        const timeoutId = setTimeout(() => {
          const docRef = doc(db, "users", user.uid, "appData", key);
          setDoc(docRef, { value: valueToStore }, { merge: true }).catch((e: any) => {
            if (e?.code === 'unavailable' || e?.message?.toLowerCase().includes('offline')) {
              // Silently handle offline set
            } else if (e?.message?.includes("Missing or insufficient permissions")) {
              console.warn(`Permission denied syncing ${key} to Firestore (Check rules)`);
            } else {
              console.error(`Error syncing ${key} to Firestore`, e);
            }
          });
          writeKeysDebounceMap.delete(key);
        }, 1500); // 1.5 second debounce

        writeKeysDebounceMap.set(key, timeoutId);
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}

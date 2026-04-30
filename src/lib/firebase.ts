import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCXdyqPAQcuNW61TAkUgcLfyu0gcZogvFA",
  authDomain: "eduplanner-df8fc.firebaseapp.com",
  projectId: "eduplanner-df8fc",
  storageBucket: "eduplanner-df8fc.firebasestorage.app",
  messagingSenderId: "910706139055",
  appId: "1:910706139055:web:4415be40f717ccc1fa195a",
  measurementId: "G-S386LD040L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

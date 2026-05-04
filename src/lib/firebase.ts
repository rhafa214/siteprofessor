import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAln0cAozZfaK6mgFl7l0kPzWdewCse37o",
  authDomain: "meueduplanner.firebaseapp.com",
  projectId: "meueduplanner",
  storageBucket: "meueduplanner.firebasestorage.app",
  messagingSenderId: "667894322951",
  appId: "1:667894322951:web:ac33c0675e7910da7ad7a2",
  measurementId: "G-NEEL4B43QH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

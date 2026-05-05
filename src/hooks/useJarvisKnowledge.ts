import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function useJarvisKnowledge() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState('');
  const [schoolModel, setSchoolModel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const curDoc = await getDoc(doc(db, 'users', user.uid, 'knowledge', 'curriculum'));
        if (curDoc.exists() && curDoc.data()?.text) setCurriculum(curDoc.data().text);

        const modDoc = await getDoc(doc(db, 'users', user.uid, 'knowledge', 'schoolModel'));
        if (modDoc.exists() && modDoc.data()?.text) setSchoolModel(modDoc.data().text);
      } catch (err) {
        console.error("Error loading jarvis knowledge", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  return { curriculum, schoolModel, loading };
}

import { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

export function useJarvisKnowledge() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState("");
  const [schoolModel, setSchoolModel] = useState("");
  const [jarvisDocs, setJarvisDocs] = useState<{title: string, content: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        let loadedCurriculum = "";
        
        // Try getting the JSON extracted array first
        const jsonDoc = await getDoc(
          doc(db, "users", user.uid, "knowledge", "curriculumJSON"),
        );
        if (jsonDoc.exists() && jsonDoc.data()?.data) {
          loadedCurriculum = JSON.stringify(jsonDoc.data().data, null, 2);
        } else {
          // Fallback to text base
          const curDoc = await getDoc(
            doc(db, "users", user.uid, "knowledge", "curriculum"),
          );
          if (curDoc.exists() && curDoc.data()?.text) {
             loadedCurriculum = curDoc.data().text;
          }
        }
        setCurriculum(loadedCurriculum);

        const modDoc = await getDoc(
          doc(db, "users", user.uid, "knowledge", "schoolModel"),
        );
        if (modDoc.exists() && modDoc.data()?.text)
          setSchoolModel(modDoc.data().text);

        const baseDoc = await getDoc(
          doc(db, "users", user.uid, "knowledge", "jarvisBase"),
        );
        if (baseDoc.exists() && baseDoc.data()?.docs) {
          setJarvisDocs(baseDoc.data().docs);
        }
      } catch (err: any) {
        if (err?.message?.includes("Missing or insufficient permissions")) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}/knowledge`);
        } else {
          console.error("Error loading jarvis knowledge", err);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  return { curriculum, schoolModel, jarvisDocs, loading };
}

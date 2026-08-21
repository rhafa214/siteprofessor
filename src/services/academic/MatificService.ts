import { collection, doc, setDoc, getDocs, query, where, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export interface CanonicalMatificWeek {
  id: string;
  uid: string;
  academicYearId: string;
  termId: string;
  classGroupId: string;
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  targetMinutes: number; // default 30
  countsTowardGoal: boolean; // default true
  createdAt: number;
  updatedAt: number;
}

export interface CanonicalMatificWeeklyResult {
  id: string;
  uid: string;
  weekId: string;
  studentId: string;
  minutes: number | null;
  activitiesCompleted: number | null;
  createdAt: number;
  updatedAt: number;
}

export class MatificService {
  async getWeeks(uid: string, academicYearId: string, termId: string, classGroupId: string): Promise<CanonicalMatificWeek[]> {
    const q = query(
      collection(db, "users", uid, "matificWeeks"),
      where("academicYearId", "==", academicYearId),
      where("termId", "==", termId),
      where("classGroupId", "==", classGroupId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalMatificWeek)).sort((a, b) => a.weekNumber - b.weekNumber);
  }

  async getResultsForWeek(uid: string, weekId: string): Promise<CanonicalMatificWeeklyResult[]> {
    const q = query(
      collection(db, "users", uid, "matificWeeklyResults"),
      where("weekId", "==", weekId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalMatificWeeklyResult));
  }

  async updateWeekStatus(uid: string, weekId: string, countsTowardGoal: boolean): Promise<void> {
    const docRef = doc(db, "users", uid, "matificWeeks", weekId);
    await updateDoc(docRef, { countsTowardGoal, updatedAt: Date.now() });
  }

  async generateWeeksFromDates(
    uid: string,
    academicYearId: string,
    termId: string,
    classGroupId: string,
    startDateStr: string,
    endDateStr: string,
    targetMinutes: number = 30
  ): Promise<CanonicalMatificWeek[]> {
    // Determine existing weeks to avoid recreation
    const existingWeeks = await this.getWeeks(uid, academicYearId, termId, classGroupId);
    if (existingWeeks.length > 0) return existingWeeks;

    const start = new Date(startDateStr + "T12:00:00");
    const end = new Date(endDateStr + "T12:00:00");
    
    const weeks: Omit<CanonicalMatificWeek, "id" | "createdAt" | "updatedAt">[] = [];
    
    let currentStart = new Date(start);
    let weekNum = 1;

    while (currentStart <= end) {
      let currentEnd = new Date(currentStart);
      // Move to Friday or the end date, whichever comes first
      let daysToFriday = 5 - currentEnd.getDay();
      if (daysToFriday < 0) daysToFriday += 7;
      
      currentEnd.setDate(currentEnd.getDate() + daysToFriday);
      if (currentEnd > end) {
        currentEnd = new Date(end);
      }

      weeks.push({
        uid,
        academicYearId,
        termId,
        classGroupId,
        weekNumber: weekNum,
        startDate: currentStart.toISOString().split("T")[0],
        endDate: currentEnd.toISOString().split("T")[0],
        targetMinutes,
        countsTowardGoal: true,
      });

      // Move to next Monday
      currentStart = new Date(currentEnd);
      let daysToMonday = 1 - currentStart.getDay();
      if (daysToMonday <= 0) daysToMonday += 7;
      currentStart.setDate(currentStart.getDate() + daysToMonday);
      weekNum++;
    }

    const batch = writeBatch(db);
    const createdWeeks: CanonicalMatificWeek[] = [];
    for (const w of weeks) {
      const ref = doc(collection(db, "users", uid, "matificWeeks"));
      const week: CanonicalMatificWeek = {
        ...w,
        id: ref.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      batch.set(ref, week);
      createdWeeks.push(week);
    }
    await batch.commit();

    return createdWeeks;
  }

  async saveWeeklyResults(uid: string, weekId: string, results: CanonicalMatificWeeklyResult[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const res of results) {
      const resultId = `result_${weekId}_${res.studentId}`;
      const ref = doc(db, "users", uid, "matificWeeklyResults", resultId);
      
      const dataToSave: any = {
        ...res,
        id: resultId,
        updatedAt: Date.now()
      };
      if (!res.createdAt) {
        dataToSave.createdAt = Date.now();
      }
      
      batch.set(ref, dataToSave, { merge: true });
    }
    
    await batch.commit();
  }

  async toggleWeekCountsTowardGoal(uid: string, weekId: string, countsTowardGoal: boolean): Promise<void> {
    const ref = doc(db, "users", uid, "matificWeeks", weekId);
    await updateDoc(ref, { countsTowardGoal, updatedAt: Date.now() });
  }
  
  async getAllResultsForTerm(uid: string, academicYearId: string, termId: string, classGroupId: string): Promise<CanonicalMatificWeeklyResult[]> {
    const weeks = await this.getWeeks(uid, academicYearId, termId, classGroupId);
    if (weeks.length === 0) return [];
    
    // Process in batches of 10 if there are many weeks, but usually terms have ~10 weeks so one batch is fine.
    // For simplicity, fetch all at once since where("weekId", "in", ...) limit is 10.
    // Instead of "in", let's fetch week by week concurrently.
    const promises = weeks.map(w => this.getResultsForWeek(uid, w.id));
    const allResults = await Promise.all(promises);
    return allResults.flat();
  }
}


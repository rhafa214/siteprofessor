import { LegacyStudentData } from '../mappers/legacyMappers';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface LegacyAcademicSnapshot {
  capturedAt: number;
  userId: string;
  sources: string[];
  localStorageData: {
    classTurmasList?: string[];
    customAulas?: unknown[];
    eduPlan?: unknown;
    eduPlans_dict?: unknown;
    eduPlans_v2?: unknown;
    classLogs?: unknown;
    [key: string]: unknown;
  };
  firestoreData: {
    taskAnalysis: Record<string, unknown>;
    matificAnalysis: Record<string, unknown>;
    pp_: Record<string, unknown>;
    assessments_grades: Record<string, unknown>;
    classLogs: Record<string, unknown>;
  };
  warnings: string[];
  errors: string[];
}

export const LOCAL_STORAGE_ALLOWLIST = [
  'classTurmasList',
  'customAulas',
  'eduPlan',
  'eduPlans_dict',
  'eduPlans_v2',
  'classLogs',
  'taskAnalysis',
  'matificAnalysis',
  'pp_',
  'assessments_grades'
];

export async function collectLocalStorageData(): Promise<LegacyAcademicSnapshot['localStorageData']> {
  const data: Record<string, unknown> = {};
  if (typeof window === 'undefined') return data;
  
  for (const i in localStorage) {
    if (localStorage.hasOwnProperty(i)) {
      // Find keys that match our prefixes/allowlist exactly or dynamically (like taskAnalysis_...)
      const isAllowed = LOCAL_STORAGE_ALLOWLIST.some(prefix => i === prefix || i.startsWith(`${prefix}_`));
      if (isAllowed) {
        try {
          data[i] = JSON.parse(localStorage.getItem(i) || 'null');
        } catch (e) {
          console.warn(`Failed to parse localStorage key ${i}`);
        }
      }
    }
  }
  return data;
}

export async function collectFirestoreData(uid: string): Promise<LegacyAcademicSnapshot['firestoreData']> {
  const firestoreData: LegacyAcademicSnapshot['firestoreData'] = {
    taskAnalysis: {},
    matificAnalysis: {},
    pp_: {},
    assessments_grades: {},
    classLogs: {}
  };

  if (!uid || typeof window === 'undefined') return firestoreData; // Skip if server or no auth

  const collectionsToFetch = ['taskAnalysis', 'matificAnalysis', 'pp_', 'assessments_grades', 'classLogs'];
  
  for (const col of collectionsToFetch) {
    try {
      const snap = await getDocs(collection(db, `users/${uid}/${col}`));
      snap.forEach(doc => {
        firestoreData[col as keyof typeof firestoreData][doc.id] = doc.data();
      });
    } catch (e) {
      console.warn(`Failed to fetch ${col} from Firestore`, e);
    }
  }

  return firestoreData;
}

export async function createLegacySnapshot(uid: string): Promise<LegacyAcademicSnapshot> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const localStorageData = await collectLocalStorageData();
  const firestoreData = await collectFirestoreData(uid);
  
  return {
    capturedAt: Date.now(),
    userId: uid,
    sources: ['localStorage', 'firestore'],
    localStorageData,
    firestoreData,
    warnings,
    errors
  };
}

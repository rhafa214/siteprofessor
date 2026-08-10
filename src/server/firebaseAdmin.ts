import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    projectId = config.projectId;
  } catch (err) {
    console.warn("Could not read firebase-applet-config.json for projectId.");
  }
}

let app;

try {
  if (!getApps().length) {
    if (projectId) {
      app = initializeApp({ projectId });
    } else {
      console.warn("Firebase Admin initialized without projectId. Verification might fail.");
      app = initializeApp();
    }
  } else {
    app = getApp();
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

export const adminAuth = app ? getAuth(app) : null;

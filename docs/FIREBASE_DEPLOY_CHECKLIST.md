# Firebase Manual Deploy Checklist

Do not execute `firebase deploy` automatically. Follow this checklist when manually deploying.

1. [ ] Confirm the correct Firebase project is selected (`firebase use <project-id>`).
2. [ ] Confirm the Firebase project is on the **Blaze** plan.
3. [ ] Configure Billing Alerts/Budgets in Google Cloud Console.
4. [ ] Authenticate Firebase CLI (`firebase login`).
5. [ ] Configure Secrets and Parameterized Configuration for Cloud Functions:
   ```sh
   # GEMINI_API_KEY must be stored as a Secret
   firebase functions:secrets:set GEMINI_API_KEY
   
   # For string parameters like AUTHORIZED_FIREBASE_UIDS and ALLOWED_ORIGINS, 
   # create a functions/.env file (do not commit it!) or define them in your environment:
   # AUTHORIZED_FIREBASE_UIDS="uid1,uid2"
   # ALLOWED_ORIGINS="https://..."
   ```
6. [ ] (Optional) Test locally using Emulator Suite: `firebase emulators:start`.
7. [ ] Build the frontend: `npm run build` at the root.
8. [ ] Build the functions: `npm run build` inside `functions/` directory.
9. [ ] Deploy Cloud Functions: `firebase deploy --only functions`
10. [ ] Deploy Firebase Hosting: `firebase deploy --only hosting`
11. [ ] Test the root `/` URL.
12. [ ] Test `/migration-admin`.
13. [ ] Test `/api/*` requests.
14. [ ] Once verified, proceed with VERCEL DECOMMISSION (remove `vercel.json`, `api/index.ts`, and Vercel project).

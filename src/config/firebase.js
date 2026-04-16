import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve } from "path";

let initialized = false;

export function initFirebase() {
  if (initialized) return;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH is not defined in environment variables."
    );
  }

  const serviceAccount = JSON.parse(
    readFileSync(resolve(serviceAccountPath), "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  console.log("Firebase Admin SDK initialized.");
}

export { admin };

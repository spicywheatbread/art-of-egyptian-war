import {
  type ServiceAccount,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  Firestore,
  getFirestore as getFirestoreInstance,
} from "firebase-admin/firestore";

let firestore: Firestore | null = null;

function getServiceAccountFromIndividualEnv(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  const hasAny =
    typeof projectId === "string" ||
    typeof clientEmail === "string" ||
    typeof rawPrivateKey === "string";
  if (!hasAny) return null;

  if (
    typeof projectId !== "string" ||
    typeof clientEmail !== "string" ||
    typeof rawPrivateKey !== "string"
  ) {
    throw new Error(
      "Firebase env vars must be set together: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function ensureFirebaseAppInitialized(): void {
  if (getApps().length > 0) return;

  const serviceAccount = getServiceAccountFromIndividualEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getFirestore(): Firestore {
  if (firestore) return firestore;
  ensureFirebaseAppInitialized();
  firestore = getFirestoreInstance();
  return firestore;
}

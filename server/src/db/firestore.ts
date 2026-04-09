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

interface ServiceAccountLike {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function getServiceAccountFromEnv(): ServiceAccountLike | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccountLike;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
}

function toServiceAccount(data: ServiceAccountLike): ServiceAccount {
  if (
    typeof data.project_id !== "string" ||
    typeof data.client_email !== "string" ||
    typeof data.private_key !== "string"
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must include project_id, client_email, and private_key",
    );
  }

  return {
    projectId: data.project_id,
    clientEmail: data.client_email,
    privateKey: data.private_key,
  };
}

function ensureFirebaseAppInitialized(): void {
  if (getApps().length > 0) return;

  const serviceAccount = getServiceAccountFromEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID ?? serviceAccount?.project_id;

  if (serviceAccount) {
    initializeApp({
      credential: cert(toServiceAccount(serviceAccount)),
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

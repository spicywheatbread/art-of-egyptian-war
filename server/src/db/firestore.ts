import {
  type ServiceAccount,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { generateKeyPairSync } from "crypto";
import {
  Firestore,
  getFirestore as getFirestoreInstance,
} from "firebase-admin/firestore";

let firestore: Firestore | null = null;

function getServiceAccountFromIndividualEnv(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const isFirestoreEmulator = typeof process.env.FIRESTORE_EMULATOR_HOST === "string";

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
    // The Firebase CLI emulator workflow often provides only FIREBASE_PROJECT_ID.
    // Treat partial credentials as "not provided" when running against emulator.
    if (isFirestoreEmulator) {
      return null;
    }
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
  const isFirestoreEmulator = typeof process.env.FIRESTORE_EMULATOR_HOST === "string";

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
    return;
  }

  // When using the Firestore emulator, allow local dev/tests without ADC or a service account.
  // We generate an ephemeral keypair because firebase-admin's cert() expects a PEM key.
  if (isFirestoreEmulator) {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    initializeApp({
      credential: cert({
        projectId: projectId ?? "demo-test",
        clientEmail: "emulator@example.com",
        privateKey: privateKey.export({ format: "pem", type: "pkcs1" }).toString(),
      }),
      projectId: projectId ?? "demo-test",
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

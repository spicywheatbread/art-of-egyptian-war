/**
 * Loaded before Firestore integration tests so Firebase Admin sees emulator settings
 * on first `getFirestore()` (see `src/db/firestore.ts`).
 */
process.env.FIREBASE_PROJECT_ID ??= "demo-test";
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

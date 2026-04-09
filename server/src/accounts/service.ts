import bcrypt from "bcrypt";
import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getFirestore } from "../db/firestore";
import type { AccountDocument, AccountStats } from "./types";

const ACCOUNTS_COLLECTION = "accounts";
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const SALT_ROUNDS = 10;

export class AccountServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AccountServiceError";
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function validateUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new AccountServiceError(
      "INVALID_USERNAME",
      "username must be 3-20 chars using letters, numbers, or underscore",
    );
  }
  return trimmed;
}

function validatePassword(password: string): string {
  if (password.length < 6 || password.length > 72) {
    throw new AccountServiceError(
      "INVALID_PASSWORD",
      "password must be between 6 and 72 characters",
    );
  }
  return password;
}

function parseAccountDocument(data: DocumentData): AccountDocument {
  if (
    typeof data.username !== "string" ||
    typeof data.passwordHash !== "string" ||
    typeof data.wins !== "number" ||
    typeof data.gamesPlayed !== "number"
  ) {
    throw new AccountServiceError("INVALID_ACCOUNT_DATA", "Account document is malformed");
  }

  return {
    username: data.username,
    passwordHash: data.passwordHash,
    wins: data.wins,
    gamesPlayed: data.gamesPlayed,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
  };
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<AccountStats> {
  const validUsername = validateUsername(username);
  const validPassword = validatePassword(password);
  const normalizedUsername = normalizeUsername(validUsername);
  const db = getFirestore();
  const ref = db.collection(ACCOUNTS_COLLECTION).doc(normalizedUsername);

  const passwordHash = await bcrypt.hash(validPassword, SALT_ROUNDS);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      throw new AccountServiceError("USERNAME_TAKEN", "Username is already taken");
    }
    tx.set(ref, {
      username: validUsername,
      passwordHash,
      wins: 0,
      gamesPlayed: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    username: validUsername,
    wins: 0,
    gamesPlayed: 0,
  };
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<AccountStats> {
  const validUsername = validateUsername(username);
  const validPassword = validatePassword(password);
  const normalizedUsername = normalizeUsername(validUsername);
  const db = getFirestore();
  const ref = db.collection(ACCOUNTS_COLLECTION).doc(normalizedUsername);

  const snap = await ref.get();
  if (!snap.exists) {
    throw new AccountServiceError("INVALID_CREDENTIALS", "Invalid username or password");
  }

  const account = parseAccountDocument(snap.data() as DocumentData);
  const isValid = await bcrypt.compare(validPassword, account.passwordHash);
  if (!isValid) {
    throw new AccountServiceError("INVALID_CREDENTIALS", "Invalid username or password");
  }

  return {
    username: account.username,
    wins: account.wins,
    gamesPlayed: account.gamesPlayed,
  };
}

export async function recordGameOutcome(
  username: string,
  didWin: boolean,
): Promise<AccountStats> {
  const validUsername = validateUsername(username);
  const normalizedUsername = normalizeUsername(validUsername);
  const db = getFirestore();
  const ref = db.collection(ACCOUNTS_COLLECTION).doc(normalizedUsername);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new AccountServiceError("ACCOUNT_NOT_FOUND", "Authenticated account not found");
    }

    const account = parseAccountDocument(snap.data() as DocumentData);
    const nextWins = account.wins + (didWin ? 1 : 0);
    const nextGamesPlayed = account.gamesPlayed + 1;

    tx.update(ref, {
      gamesPlayed: FieldValue.increment(1),
      wins: FieldValue.increment(didWin ? 1 : 0),
    });

    return {
      username: account.username,
      wins: nextWins,
      gamesPlayed: nextGamesPlayed,
    };
  });
}

/**
 * Authenticated encryption for DR archives (AES-256-GCM + PBKDF2).
 * Passwords / tokens / service keys must never be packed into plaintext JSON.
 */

import { fromUtf8, utf8 } from "./hash";

const PBKDF2_ITERS = 210_000;
const SALT_LEN = 16;
const IV_LEN = 12;

export type EncryptedPackage = {
  v: 1;
  alg: "AES-256-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  /** Unencrypted verification label for quick triage. */
  verificationHint: string;
  exportedAt: string;
  app: "shaheen-driver-compliance-dr";
};

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(utf8(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations: PBKDF2_ITERS,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptArchiveBytes(
  plain: Uint8Array,
  passphrase: string,
  meta: { verificationHint: string; exportedAt: string },
): Promise<EncryptedPackage> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Encryption passphrase must be at least 8 characters");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.slice() },
    key,
    plain.slice(),
  );
  return {
    v: 1,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERS,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(cipherBuf)),
    verificationHint: meta.verificationHint,
    exportedAt: meta.exportedAt,
    app: "shaheen-driver-compliance-dr",
  };
}

export async function decryptArchiveBytes(
  pkg: EncryptedPackage,
  passphrase: string,
): Promise<Uint8Array> {
  if (pkg.v !== 1 || pkg.alg !== "AES-256-GCM") {
    throw new Error("Unsupported encrypted archive format");
  }
  const salt = unb64(pkg.salt);
  const iv = unb64(pkg.iv);
  const key = await deriveKey(passphrase, salt);
  const cipher = unb64(pkg.ciphertext);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.slice() },
      key,
      cipher.slice(),
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error("Decryption failed — wrong passphrase or corrupt archive");
  }
}

export function isEncryptedPackage(v: unknown): v is EncryptedPackage {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (v as EncryptedPackage).app === "shaheen-driver-compliance-dr" &&
    (v as EncryptedPackage).v === 1 &&
    typeof (v as EncryptedPackage).ciphertext === "string"
  );
}

export function encryptedPackageToBytes(pkg: EncryptedPackage): Uint8Array {
  return utf8(JSON.stringify(pkg, null, 2));
}

export function parseEncryptedPackage(text: string): EncryptedPackage {
  const parsed = JSON.parse(text) as unknown;
  if (!isEncryptedPackage(parsed)) throw new Error("Not an encrypted Compliance DR package");
  return parsed;
}

export function decryptHintFromText(text: string): string | null {
  try {
    const p = JSON.parse(text) as EncryptedPackage;
    return isEncryptedPackage(p) ? p.verificationHint : null;
  } catch {
    return null;
  }
}

export { fromUtf8 };

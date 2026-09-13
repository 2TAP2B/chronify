import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.AU_CERT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "AU_CERT_ENCRYPTION_KEY must be a 32-byte hex string (64 chars). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptFile(plaintext: Buffer): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]);
}

export function decryptFile(ciphertext: Buffer): Buffer {
  const key = getKey();
  if (ciphertext.length < IV_LEN + TAG_LEN) {
    throw new Error("Encrypted file too short");
  }
  const iv = ciphertext.subarray(0, IV_LEN);
  const tag = ciphertext.subarray(ciphertext.length - TAG_LEN);
  const data = ciphertext.subarray(IV_LEN, ciphertext.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function isEncrypted(data: Buffer): boolean {
  return data.length >= IV_LEN + TAG_LEN;
}

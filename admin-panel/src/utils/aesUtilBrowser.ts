/* eslint-disable @typescript-eslint/no-explicit-any */
import security from "../config/security.json";

const textEnc = new TextEncoder();
const textDec = new TextDecoder();

/** Convert any Uint8Array view into a plain ArrayBuffer slice (no generics). */
function toAB(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = (hex || "").replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.substr(i, 2), 16);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function padKeyTo256Hex(keyHex: string): string {
  let k = keyHex || "";
  while (k.length < 64) k += k;
  return k.substring(0, 64);
}

function first16BytesOfPaddedKey(keyHex: string): Uint8Array {
  const padded = hexToBytes(padKeyTo256Hex(keyHex));
  return padded.subarray(0, 16);
}

async function aesCbcEncryptBase64(
  keyBytes: Uint8Array,
  ivBytes: Uint8Array,
  plaintextUtf8: string,
  keyLenBits: 128 | 256
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toAB(keyBytes), // <-- pass ArrayBuffer
    { name: "AES-CBC", length: keyLenBits },
    false,
    ["encrypt"]
  );
  const ct = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: toAB(ivBytes) }, // <-- pass ArrayBuffer
    key,
    toAB(textEnc.encode(plaintextUtf8)) // <-- pass ArrayBuffer
  );
  return bytesToBase64(new Uint8Array(ct));
}

async function aesCbcDecryptBase64(
  keyBytes: Uint8Array,
  ivBytes: Uint8Array,
  ciphertextBase64: string,
  keyLenBits: 128 | 256
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toAB(keyBytes),
    { name: "AES-CBC", length: keyLenBits },
    false,
    ["decrypt"]
  );
  const pt = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: toAB(ivBytes) },
    key,
    toAB(base64ToBytes(ciphertextBase64))
  );
  return textDec.decode(pt);
}

async function hmacSha256Hex(secretUtf8: string, dataUtf8: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toAB(textEnc.encode(secretUtf8)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, toAB(textEnc.encode(dataUtf8)));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ====== CONFIG from security.json ======
const CONFIG = {
  GENERIC_AES_KEY_HEX: security.aes_key,
  GENERIC_AES_IV_HEX: security.aes_iv,
  PASSWORD_AES_KEY_HEX: security.password_aes_key,
  PASSWORD_AES_IV_HEX: security.password_aes_iv,
  MANIFEST_AES_KEY_HEX: security.manifest_aes_key,
  MANIFEST_AES_IV_HEX: security.manifest_aes_iv,
  DEVICE_SECRET_KEY: security.device_secret,
};

// ====== Public API ======
export async function encryptGenericPayload(dataUtf8: string): Promise<string> {
  const key16 = first16BytesOfPaddedKey(CONFIG.GENERIC_AES_KEY_HEX);
  const iv = hexToBytes(CONFIG.GENERIC_AES_IV_HEX);
  return aesCbcEncryptBase64(key16, iv, dataUtf8, 128);
}

export async function decryptGenericPayload(encryptedBase64: string): Promise<string> {
  const key16 = first16BytesOfPaddedKey(CONFIG.GENERIC_AES_KEY_HEX);
  const iv = hexToBytes(CONFIG.GENERIC_AES_IV_HEX);
  return aesCbcDecryptBase64(key16, iv, encryptedBase64, 128);
}

export async function encryptPasswordPayload(dataUtf8: string): Promise<string> {
  const key32 = hexToBytes(padKeyTo256Hex(CONFIG.PASSWORD_AES_KEY_HEX));
  const iv = hexToBytes(CONFIG.PASSWORD_AES_IV_HEX);
  return aesCbcEncryptBase64(key32, iv, dataUtf8, 256);
}

export async function decryptPasswordPayload(encryptedBase64: string): Promise<string> {
  const key32 = hexToBytes(padKeyTo256Hex(CONFIG.PASSWORD_AES_KEY_HEX));
  const iv = hexToBytes(CONFIG.PASSWORD_AES_IV_HEX);
  return aesCbcDecryptBase64(key32, iv, encryptedBase64, 256);
}

export async function encryptManifestApiKeyPayload(dataUtf8: string): Promise<string> {
  const key32 = hexToBytes(padKeyTo256Hex(CONFIG.MANIFEST_AES_KEY_HEX));
  const iv = hexToBytes(CONFIG.MANIFEST_AES_IV_HEX);
  return aesCbcEncryptBase64(key32, iv, dataUtf8, 256);
}

export async function decryptManifestApiKeyPayload(encryptedBase64: string): Promise<string> {
  const key32 = hexToBytes(padKeyTo256Hex(CONFIG.MANIFEST_AES_KEY_HEX));
  const iv = hexToBytes(CONFIG.MANIFEST_AES_IV_HEX);
  return aesCbcDecryptBase64(key32, iv, encryptedBase64, 256);
}

export async function generateHmac(passwordUtf8: string, secretUtf8?: string): Promise<string> {
  const secret = secretUtf8 ?? CONFIG.DEVICE_SECRET_KEY;
  return hmacSha256Hex(secret, passwordUtf8);
}

export async function verifyAndExtractPasswordPayload(encryptedBase64: string): Promise<string> {
  const decrypted = await decryptPasswordPayload(encryptedBase64);
  const [password, receivedHmac] = decrypted.split(":");
  if (!password || !receivedHmac) throw new Error("Invalid password structure");
  const recalculated = await generateHmac(password);
  if (recalculated !== receivedHmac) throw new Error("Integrity check failed: HMAC mismatch");
  return password;
}

// Aliases to match Node names if used elsewhere
export const encryptMyData = encryptGenericPayload;
export const decryptMydata = decryptGenericPayload;

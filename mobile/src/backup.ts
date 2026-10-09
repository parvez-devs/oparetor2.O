import CryptoJS from "crypto-js";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getPassword } from "./storage";
import type { Preferences, UIDEntry } from "./types";

export interface BackupPayload {
  version: 1;
  createdAt: string;
  uids: UIDEntry[];
  prefs: Preferences;
  passwords: Record<string, string>;
}

interface Envelope {
  format: "uid2-encrypted-backup";
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function deriveKeys(passphrase: string, saltHex: string) {
  const derived = CryptoJS.PBKDF2(passphrase, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 16,
    iterations: 180000,
    hasher: CryptoJS.algo.SHA256
  });
  const encKey = CryptoJS.lib.WordArray.create(derived.words.slice(0, 8), 32);
  const macKey = CryptoJS.lib.WordArray.create(derived.words.slice(8, 16), 32);
  return { encKey, macKey };
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function exportEncryptedBackup(
  userId: string,
  uids: UIDEntry[],
  prefs: Preferences,
  passphrase: string
) {
  if (passphrase.length < 8) throw new Error("Backup passphrase must be at least 8 characters");

  const passwords: Record<string, string> = {};
  for (const entry of uids) {
    if (!entry.hasPassword) continue;
    const password = await getPassword(userId, entry.id);
    if (password) passwords[entry.id] = password;
  }

  const payload: BackupPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    uids,
    prefs,
    passwords
  };

  const salt = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const iv = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const { encKey, macKey } = deriveKeys(passphrase, salt);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), encKey, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  const ciphertext = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  const mac = CryptoJS.HmacSHA256(salt + "." + iv + "." + ciphertext, macKey).toString(CryptoJS.enc.Hex);

  const envelope: Envelope = {
    format: "uid2-encrypted-backup",
    version: 1,
    salt,
    iv,
    ciphertext,
    mac
  };

  const uri = (FileSystem.cacheDirectory || "") + "UID-2.O-backup-" + Date.now() + ".uid2";
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(envelope), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/octet-stream", dialogTitle: "Export UID 2.O encrypted backup" });
  }
  return uri;
}

export async function importEncryptedBackup(passphrase: string): Promise<BackupPayload | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ["application/octet-stream", "application/json", "text/plain"]
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) return null;

  const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  const envelope = JSON.parse(raw) as Envelope;
  if (envelope.format !== "uid2-encrypted-backup" || envelope.version !== 1) throw new Error("Unsupported backup file");

  const { encKey, macKey } = deriveKeys(passphrase, envelope.salt);
  const expected = CryptoJS.HmacSHA256(
    envelope.salt + "." + envelope.iv + "." + envelope.ciphertext,
    macKey
  ).toString(CryptoJS.enc.Hex);

  if (!secureEqual(expected, envelope.mac)) throw new Error("Wrong passphrase or damaged backup");

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(envelope.ciphertext) } as CryptoJS.lib.CipherParams,
    encKey,
    {
      iv: CryptoJS.enc.Hex.parse(envelope.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );
  const text = decrypted.toString(CryptoJS.enc.Utf8);
  if (!text) throw new Error("Unable to decrypt backup");
  return JSON.parse(text) as BackupPayload;
}

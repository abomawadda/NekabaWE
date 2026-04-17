export const SESSION_STORAGE_KEY = "nekaba_secure_session_v2";
export const LOGIN_ATTEMPTS_STORAGE_KEY = "nekaba_login_attempts_v2";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashValue(value = "") {
  const content = new TextEncoder().encode(String(value));
  const buffer = await crypto.subtle.digest("SHA-256", content);
  return toHex(buffer);
}

export function randomToken(length = 24) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildDeviceFingerprint() {
  if (typeof window === "undefined") return "server";
  const screenPart = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  return [
    navigator.userAgent || "ua",
    navigator.language || "lang",
    navigator.platform || "platform",
    screenPart,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "tz",
  ].join("::");
}

export async function buildSessionIntegrity({ sessionId, userId, token, fingerprint, expiresAt }) {
  return hashValue([sessionId, userId, token, fingerprint, expiresAt].join("::"));
}

export function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("تعذر قراءة الجلسة المؤمنة:", error);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function writeStoredSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function readLoginAttempts() {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    localStorage.removeItem(LOGIN_ATTEMPTS_STORAGE_KEY);
    return {};
  }
}

export function writeLoginAttempts(state) {
  localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(state));
}

export function normalizeLoginIdentifier(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function isSessionExpired(expiresAt) {
  return !expiresAt || new Date(expiresAt).getTime() <= Date.now();
}

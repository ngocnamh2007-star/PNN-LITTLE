import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteState, readState, writeState } from "./api/state-store";

const PASSWORD_KEY = "admin-password-hash";
const ACCOUNT_KEY = "admin-accounts";
const SESSION_PREFIX = "admin-session:";
const SESSION_INDEX_PREFIX = "admin-sessions:";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 14;
const OWNER_SESSION_INDEX_KEY = "owner-sessions";
export const SESSION_COOKIE = "pnn_admin_session";
export const OWNER_COOKIE = "pnn_owner_session";

type AdminSessionState = {
  id: string;
  token: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  device: string;
  ip: string;
  location: string;
  revokedAt?: number;
};

type AdminAccount = {
  username: string;
  email: string;
  phone: string;
  passwordHash: string;
  disabled?: boolean;
  mustChangePassword?: boolean;
};

type OwnerSessionState = {
  id: string;
  token: string;
  passwordHash: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  device: string;
  ip: string;
  location: string;
  revokedAt?: number;
};

export type AdminSessionInfo = Omit<AdminSessionState, "token" | "passwordHash"> & { active: boolean; current: boolean };

function secret(name: "ADMIN_PASSWORD" | "ADMIN_SALT") {
  const runtime = env as unknown as Record<string, unknown>;
  return typeof runtime[name] === "string" ? (runtime[name] as string) : "";
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(`${secret("ADMIN_SALT")}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sessionIndexKey(username: string) {
  return `${SESSION_INDEX_PREFIX}${encodeURIComponent(username.trim().toLowerCase())}`;
}

function requestIp(request?: Request) {
  if (!request) return "Không xác định";
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "Không xác định";
}

function requestLocation(request?: Request) {
  if (!request) return "Không xác định";
  const decode = (value: string | null) => {
    if (!value) return "";
    try { return decodeURIComponent(value); } catch { return value; }
  };
  const city = decode(request.headers.get("cf-ipcity"));
  const region = decode(request.headers.get("cf-region"));
  const country = decode(request.headers.get("cf-ipcountry"));
  return [city, region, country].filter(Boolean).join(", ") || "Không xác định";
}

function deviceName(userAgent: string) {
  if (!userAgent) return "Thiết bị không xác định";
  const browser = /Edg\//i.test(userAgent) ? "Edge" : /Chrome\//i.test(userAgent) ? "Chrome" : /Firefox\//i.test(userAgent) ? "Firefox" : /Safari\//i.test(userAgent) ? "Safari" : "Trình duyệt khác";
  const device = /iPhone/i.test(userAgent) ? "iPhone" : /iPad/i.test(userAgent) ? "iPad" : /Android/i.test(userAgent) ? "Android" : /Macintosh|Mac OS X/i.test(userAgent) ? "Mac" : /Windows/i.test(userAgent) ? "Windows" : /Linux/i.test(userAgent) ? "Linux" : "Thiết bị khác";
  return `${device} · ${browser}`;
}

async function passwordHashFor(username: string) {
  const account = (await listAdminAccounts())[username.trim().toLowerCase()];
  return account?.passwordHash ?? (await readState<string>(PASSWORD_KEY)) ?? (await hashPassword(secret("ADMIN_PASSWORD")));
}

async function readSessionIndex(username: string) {
  return (await readState<AdminSessionState[]>(sessionIndexKey(username))) ?? [];
}

async function writeSessionIndex(username: string, sessions: AdminSessionState[]) {
  await writeState(sessionIndexKey(username), sessions.slice(-40));
}

export async function verifyPassword(password: string) {
  const storedHash = await readState<string>(PASSWORD_KEY);
  const expectedHash = storedHash ?? (await hashPassword(secret("ADMIN_PASSWORD")));
  const receivedHash = await hashPassword(password);
  if (expectedHash.length !== receivedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index++) {
    difference |= expectedHash.charCodeAt(index) ^ receivedHash.charCodeAt(index);
  }
  return difference === 0;
}

export async function hasAdminAccount() {
  const accounts = await readState<Record<string, AdminAccount>>(ACCOUNT_KEY);
  return Boolean(accounts && Object.keys(accounts).length);
}

function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, "").replace(/^\+84/, "0");
}

export async function findAdminAccount(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  const accounts = await readState<Record<string, AdminAccount>>(ACCOUNT_KEY);
  if (!accounts) return null;
  return accounts[clean] || Object.values(accounts).find((account) => account.email?.trim().toLowerCase() === clean || normalizePhone(account.phone || "") === normalizePhone(identifier)) || null;
}

export async function adminUsernameForIdentifier(identifier: string) {
  return (await findAdminAccount(identifier))?.username || identifier.trim();
}

export async function findAdminAccountByEmail(email: string) {
  const account = await findAdminAccount(email);
  return account && account.email?.trim().toLowerCase() === email.trim().toLowerCase() ? account : null;
}

export async function verifyAdminCredentials(username: string, password: string) {
  const account = await findAdminAccount(username);
  if (account) return !account.disabled && (await hashPassword(password)) === account.passwordHash;
  const accounts = await readState<Record<string, AdminAccount>>(ACCOUNT_KEY);
  if (accounts && Object.keys(accounts).length) return false;
  return verifyPassword(password);
}

export async function isAdminAccountDisabled(username: string) {
  return Boolean((await findAdminAccount(username))?.disabled);
}

export async function createAdminAccount(username: string, password: string, email: string, phone: string) {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = normalizePhone(phone);
  if (!cleanUsername || !cleanEmail || !cleanPhone || password.length < 8) throw new Error("Invalid account");
  const accounts = (await readState<Record<string, AdminAccount>>(ACCOUNT_KEY)) ?? {};
  if (accounts[cleanUsername.toLowerCase()] || Object.values(accounts).some((account) => account.email?.toLowerCase() === cleanEmail || normalizePhone(account.phone || "") === cleanPhone)) throw new Error("Account exists");
  const passwordHash = await hashPassword(password);
  accounts[cleanUsername.toLowerCase()] = { username: cleanUsername, email: cleanEmail, phone: cleanPhone, passwordHash, mustChangePassword: false };
  await writeState(ACCOUNT_KEY, accounts);
}

export async function deleteAdminAccount(username: string) {
  const accounts = (await readState<Record<string, { username: string; passwordHash: string }>>(ACCOUNT_KEY)) ?? {};
  delete accounts[username.trim().toLowerCase()];
  await writeState(ACCOUNT_KEY, accounts);
  await deleteState(`love-config:${encodeURIComponent(username)}`);
  await deleteState(`love-music:${encodeURIComponent(username)}`);
  await deleteState(`gift-selection:${encodeURIComponent(username)}`);
  const sessions = await readSessionIndex(username);
  await Promise.all(sessions.map((session) => deleteState(`${SESSION_PREFIX}${session.token}`)));
  await deleteState(sessionIndexKey(username));
}

export async function listAdminAccounts() {
  return (await readState<Record<string, AdminAccount>>(ACCOUNT_KEY)) ?? {};
}

export async function setAdminAccountDisabled(username: string, disabled: boolean) {
  const accounts = await listAdminAccounts();
  const key = username.trim().toLowerCase();
  if (!accounts[key]) return false;
  accounts[key].disabled = disabled;
  await writeState(ACCOUNT_KEY, accounts);
  return true;
}

export async function changeAdminPasswordByOwner(username: string, password: string) {
  const accounts = await listAdminAccounts();
  const key = username.trim().toLowerCase();
  if (!accounts[key] || password.length < 8) return false;
  const passwordHash = await hashPassword(password);
  accounts[key].passwordHash = passwordHash;
  await writeState(ACCOUNT_KEY, accounts);
  return true;
}

export async function verifyAdminPasswordFor(username: string, password: string) {
  const accounts = await listAdminAccounts();
  const account = accounts[username.trim().toLowerCase()];
  if (account) return (await hashPassword(password)) === account.passwordHash;
  return verifyPassword(password);
}

export async function changeAdminPasswordFor(username: string, password: string) {
  const accounts = await listAdminAccounts();
  const key = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  if (accounts[key]) {
    accounts[key].passwordHash = passwordHash;
    accounts[key].mustChangePassword = false;
    await writeState(ACCOUNT_KEY, accounts);
  } else {
    await writeState(PASSWORD_KEY, passwordHash);
  }
  return passwordHash;
}

export async function adminMustChangePassword(username: string) {
  return Boolean((await findAdminAccount(username))?.mustChangePassword);
}

export async function resetAdminPasswordByEmail(email: string, password: string) {
  const account = await findAdminAccountByEmail(email);
  if (!account) return null;
  const accounts = await listAdminAccounts();
  const key = account.username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  accounts[key].passwordHash = passwordHash;
  accounts[key].mustChangePassword = true;
  await writeState(ACCOUNT_KEY, accounts);
  return account;
}

async function ownerPasswordHash() {
  return (await readState<string>("owner-password-hash")) ?? (await hashPassword(secret("ADMIN_PASSWORD")));
}

export async function verifyOwnerPassword(password: string) {
  const stored = await readState<string>("owner-password-hash");
  if (stored) return (await hashPassword(password)) === stored;
  const expected = secret("ADMIN_PASSWORD");
  return Boolean(expected) && password === expected;
}

export async function changeOwnerPassword(password: string) { if (password.length < 8) return null; const passwordHash = await hashPassword(password); await writeState("owner-password-hash", passwordHash); return passwordHash; }

function ownerTokenFromRequest(request: Request) {
  return request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${OWNER_COOKIE}=`))?.split("=")[1];
}

async function readOwnerSessionIndex() {
  return (await readState<OwnerSessionState[]>(OWNER_SESSION_INDEX_KEY)) ?? [];
}

async function writeOwnerSessionIndex(sessions: OwnerSessionState[]) {
  await writeState(OWNER_SESSION_INDEX_KEY, sessions.slice(-40));
}

export async function createOwnerSession(request?: Request) {
  const token = crypto.randomUUID();
  const now = Date.now();
  const session: OwnerSessionState = {
    id: crypto.randomUUID(),
    token,
    passwordHash: await ownerPasswordHash(),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + 1000 * 60 * 60 * 8,
    device: deviceName(request?.headers.get("user-agent") || ""),
    ip: requestIp(request),
    location: requestLocation(request),
  };
  await writeState(`owner-session:${token}`, session);
  const sessions = (await readOwnerSessionIndex()).filter((item) => item.expiresAt > now - 1000 * 60 * 60 * 8);
  sessions.push(session);
  await writeOwnerSessionIndex(sessions);
  return token;
}

export async function isOwnerRequest(request: Request) {
  const token = ownerTokenFromRequest(request);
  if (!token) return false;
  const session = await readState<Partial<OwnerSessionState>>(`owner-session:${token}`);
  if (!session || (session.expiresAt || 0) <= Date.now() || session.revokedAt) return false;
  if (session.passwordHash && session.passwordHash !== await ownerPasswordHash()) return false;
  return true;
}

export async function ownerSessionFromRequest(request: Request) {
  const token = ownerTokenFromRequest(request);
  if (!token || !(await isOwnerRequest(request))) return null;
  const stored = await readState<Partial<OwnerSessionState>>(`owner-session:${token}`);
  if (!stored) return null;
  if (stored.id && stored.token && stored.location !== undefined) return stored as OwnerSessionState;
  const migrated: OwnerSessionState = {
    id: stored.id || crypto.randomUUID(),
    token,
    passwordHash: stored.passwordHash || await ownerPasswordHash(),
    createdAt: stored.createdAt || Date.now(),
    lastSeenAt: stored.lastSeenAt || Date.now(),
    expiresAt: stored.expiresAt || Date.now() + 1000 * 60 * 60 * 8,
    device: stored.device || "Thiết bị cũ",
    ip: stored.ip || "Không xác định",
    location: stored.location || "Không xác định",
  };
  await writeState(`owner-session:${token}`, migrated);
  const sessions = await readOwnerSessionIndex();
  if (!sessions.some((item) => item.id === migrated.id)) { sessions.push(migrated); await writeOwnerSessionIndex(sessions); }
  return migrated;
}

export async function touchOwnerSession(request: Request) {
  const session = await ownerSessionFromRequest(request);
  if (!session || Date.now() - session.lastSeenAt < 60_000) return session;
  const updated = { ...session, lastSeenAt: Date.now() };
  await writeState(`owner-session:${session.token}`, updated);
  const sessions = await readOwnerSessionIndex();
  await writeOwnerSessionIndex(sessions.map((item) => item.id === session.id ? updated : item));
  return updated;
}

export async function listOwnerSessions() { return readOwnerSessionIndex(); }

export async function ownerSessionIsActive(session: OwnerSessionState) {
  return !session.revokedAt && session.expiresAt > Date.now() && isOwnerRequest(new Request("https://session.local", { headers: { cookie: `${OWNER_COOKIE}=${session.token}` } }));
}

export async function revokeOwnerSession(sessionId: string) {
  const sessions = await readOwnerSessionIndex();
  const target = sessions.find((session) => session.id === sessionId);
  if (!target) return false;
  target.revokedAt = Date.now();
  await writeOwnerSessionIndex(sessions);
  await deleteState(`owner-session:${target.token}`);
  return true;
}

export async function revokeAllOwnerSessions(exceptSessionId?: string) {
  const sessions = await readOwnerSessionIndex();
  let changed = false;
  for (const session of sessions) {
    if (session.id === exceptSessionId || session.revokedAt) continue;
    session.revokedAt = Date.now();
    changed = true;
    await deleteState(`owner-session:${session.token}`);
  }
  if (changed) await writeOwnerSessionIndex(sessions);
  return changed;
}

export async function updateOwnerSessionPassword(sessionId: string, passwordHash: string) {
  const sessions = await readOwnerSessionIndex();
  const target = sessions.find((session) => session.id === sessionId);
  if (!target) return false;
  target.passwordHash = passwordHash;
  await writeOwnerSessionIndex(sessions);
  const current = await readState<OwnerSessionState>(`owner-session:${target.token}`);
  if (current) await writeState(`owner-session:${target.token}`, { ...current, passwordHash });
  return true;
}

export async function updateAllOwnerSessionPasswords(passwordHash: string) {
  const sessions = await readOwnerSessionIndex();
  let changed = false;
  for (const session of sessions) {
    if (session.revokedAt || session.expiresAt <= Date.now()) continue;
    session.passwordHash = passwordHash;
    changed = true;
    const current = await readState<OwnerSessionState>(`owner-session:${session.token}`);
    if (current) await writeState(`owner-session:${session.token}`, { ...current, passwordHash });
  }
  if (changed) await writeOwnerSessionIndex(sessions);
  return changed;
}

export async function changePassword(password: string) {
  await writeState(PASSWORD_KEY, await hashPassword(password));
}

export async function createAdminSession() {
  return createAdminSessionFor("admin");
}

export async function createAdminSessionFor(username = "admin", request?: Request) {
  const token = crypto.randomUUID();
  const now = Date.now();
  const cleanUsername = await adminUsernameForIdentifier(username.trim() || "admin") || "admin";
  const session: AdminSessionState = {
    id: crypto.randomUUID(),
    token,
    username: cleanUsername,
    passwordHash: await passwordHashFor(cleanUsername),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL,
    device: deviceName(request?.headers.get("user-agent") || ""),
    ip: requestIp(request),
    location: requestLocation(request),
  };
  await writeState(`${SESSION_PREFIX}${token}`, session);
  const sessions = (await readSessionIndex(cleanUsername)).filter((item) => item.expiresAt > now - SESSION_TTL);
  sessions.push(session);
  await writeSessionIndex(cleanUsername, sessions);
  return token;
}

export async function isValidAdminToken(token: string | undefined) {
  if (!token) return false;
  const session = await readState<AdminSessionState>(`${SESSION_PREFIX}${token}`);
  if (!session || session.expiresAt <= Date.now() || session.revokedAt) return false;
  const accounts = await listAdminAccounts();
  const account = accounts[session.username.trim().toLowerCase()];
  if (account && (account.passwordHash !== session.passwordHash || account.disabled)) return false;
  if (!account && Object.keys(accounts).length) return false;
  if (!account && session.passwordHash !== await passwordHashFor(session.username)) return false;
  return true;
}

export async function usernameFromToken(token: string | undefined) {
  if (!token) return null;
  if (!(await isValidAdminToken(token))) return null;
  const session = await readState<AdminSessionState>(`${SESSION_PREFIX}${token}`);
  return session?.username ?? null;
}

export function tokenFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
}

export async function isAdminRequest(request: Request) {
  return isValidAdminToken(tokenFromRequest(request));
}

export async function adminUsernameFromRequest(request: Request) {
  return usernameFromToken(tokenFromRequest(request));
}

export async function adminSessionFromRequest(request: Request) {
  const token = tokenFromRequest(request);
  if (!token || !(await isValidAdminToken(token))) return null;
  const stored = await readState<Partial<AdminSessionState>>(`${SESSION_PREFIX}${token}`);
  if (!stored) return null;
  if (stored.id && stored.token) return stored as AdminSessionState;
  const migrated: AdminSessionState = {
    id: stored.id || crypto.randomUUID(),
    token,
    username: stored.username || "admin",
    passwordHash: stored.passwordHash || await passwordHashFor(stored.username || "admin"),
    createdAt: stored.createdAt || Date.now(),
    lastSeenAt: stored.lastSeenAt || Date.now(),
    expiresAt: stored.expiresAt || Date.now() + SESSION_TTL,
    device: stored.device || "Thiết bị cũ",
    ip: stored.ip || "Không xác định",
    location: stored.location || "Không xác định",
  };
  await writeState(`${SESSION_PREFIX}${token}`, migrated);
  const sessions = await readSessionIndex(migrated.username);
  if (!sessions.some((item) => item.id === migrated.id)) {
    sessions.push(migrated);
    await writeSessionIndex(migrated.username, sessions);
  }
  return migrated;
}

export async function adminSessionFailureCode(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) return "SESSION_REVOKED";
  const session = await readState<Partial<AdminSessionState>>(`${SESSION_PREFIX}${token}`);
  if (session?.username && await isAdminAccountDisabled(session.username)) return "ACCOUNT_LOCKED";
  return "SESSION_REVOKED";
}

export async function touchAdminSession(request: Request) {
  const session = await adminSessionFromRequest(request);
  if (!session || Date.now() - session.lastSeenAt < 60_000) return session;
  const updated = { ...session, lastSeenAt: Date.now() };
  await writeState(`${SESSION_PREFIX}${session.token}`, updated);
  const sessions = await readSessionIndex(session.username);
  const next = sessions.map((item) => item.id === session.id ? updated : item);
  await writeSessionIndex(session.username, next);
  return updated;
}

export async function listAdminSessions(username: string) {
  return readSessionIndex(username);
}

export async function adminSessionIsActive(session: AdminSessionState) {
  if (session.revokedAt || session.expiresAt <= Date.now()) return false;
  return isValidAdminToken(session.token);
}

export async function revokeAdminSession(username: string, sessionId: string) {
  const sessions = await readSessionIndex(username);
  const target = sessions.find((session) => session.id === sessionId);
  if (!target) return false;
  target.revokedAt = Date.now();
  await writeSessionIndex(username, sessions);
  await deleteState(`${SESSION_PREFIX}${target.token}`);
  return true;
}

export async function revokeAllAdminSessions(username: string, exceptSessionId?: string) {
  const sessions = await readSessionIndex(username);
  const now = Date.now();
  let changed = false;
  for (const session of sessions) {
    if (session.id === exceptSessionId || session.revokedAt) continue;
    session.revokedAt = now;
    changed = true;
    await deleteState(`${SESSION_PREFIX}${session.token}`);
  }
  if (changed) await writeSessionIndex(username, sessions);
  return changed;
}

export async function updateAdminSessionPassword(username: string, sessionId: string, passwordHash: string) {
  const sessions = await readSessionIndex(username);
  const target = sessions.find((session) => session.id === sessionId);
  if (!target) return false;
  target.passwordHash = passwordHash;
  await writeSessionIndex(username, sessions);
  const current = await readState<AdminSessionState>(`${SESSION_PREFIX}${target.token}`);
  if (current) await writeState(`${SESSION_PREFIX}${target.token}`, { ...current, passwordHash });
  return true;
}

export async function updateAllAdminSessionPasswords(username: string, passwordHash: string) {
  const sessions = await readSessionIndex(username);
  let changed = false;
  for (const session of sessions) {
    if (session.revokedAt || session.expiresAt <= Date.now()) continue;
    session.passwordHash = passwordHash;
    changed = true;
    const current = await readState<AdminSessionState>(`${SESSION_PREFIX}${session.token}`);
    if (current) await writeState(`${SESSION_PREFIX}${session.token}`, { ...current, passwordHash });
  }
  if (changed) await writeSessionIndex(username, sessions);
  return changed;
}

export function scopedStateKey(base: string, username: string | null | undefined) {
  return `${base}:${encodeURIComponent(username || "legacy")}`;
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(SESSION_COOKIE)?.value))) {
    redirect("/admin/login");
  }
}

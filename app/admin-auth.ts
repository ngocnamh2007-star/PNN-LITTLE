import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteState, readState, writeState } from "./api/state-store";

const PASSWORD_KEY = "admin-password-hash";
const ACCOUNT_KEY = "admin-accounts";
const SESSION_PREFIX = "admin-session:";
export const SESSION_COOKIE = "pnn_admin_session";
export const OWNER_COOKIE = "pnn_owner_session";

function secret(name: "ADMIN_PASSWORD" | "ADMIN_SALT") {
  const runtime = env as unknown as Record<string, unknown>;
  return typeof runtime[name] === "string" ? (runtime[name] as string) : "";
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(`${secret("ADMIN_SALT")}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  const accounts = await readState<Record<string, { username: string; passwordHash: string }>>(ACCOUNT_KEY);
  return Boolean(accounts && Object.keys(accounts).length);
}

export async function verifyAdminCredentials(username: string, password: string) {
  const cleanUsername = username.trim().toLowerCase();
  const accounts = await readState<Record<string, { username: string; passwordHash: string }>>(ACCOUNT_KEY);
  const account = accounts?.[cleanUsername];
  if (account) return !account.disabled && (await hashPassword(password)) === account.passwordHash;
  if (accounts && Object.keys(accounts).length) return false;
  return verifyPassword(password);
}

export async function createAdminAccount(username: string, password: string) {
  const cleanUsername = username.trim();
  if (!cleanUsername || password.length < 8) throw new Error("Invalid account");
  const accounts = (await readState<Record<string, { username: string; passwordHash: string }>>(ACCOUNT_KEY)) ?? {};
  if (accounts[cleanUsername.toLowerCase()]) throw new Error("Account exists");
  const passwordHash = await hashPassword(password);
  accounts[cleanUsername.toLowerCase()] = { username: cleanUsername, passwordHash };
  await writeState(ACCOUNT_KEY, accounts);
}

export async function deleteAdminAccount(username: string) {
  const accounts = (await readState<Record<string, { username: string; passwordHash: string }>>(ACCOUNT_KEY)) ?? {};
  delete accounts[username.trim().toLowerCase()];
  await writeState(ACCOUNT_KEY, accounts);
  await deleteState(`love-config:${encodeURIComponent(username)}`);
  await deleteState(`love-music:${encodeURIComponent(username)}`);
  await deleteState(`gift-selection:${encodeURIComponent(username)}`);
}

export async function listAdminAccounts() {
  return (await readState<Record<string, { username: string; passwordHash: string; disabled?: boolean }>>(ACCOUNT_KEY)) ?? {};
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

export async function verifyOwnerPassword(password: string) {
  const stored = await readState<string>("owner-password-hash");
  if (stored) return (await hashPassword(password)) === stored;
  const expected = secret("ADMIN_PASSWORD");
  return Boolean(expected) && password === expected;
}

export async function changeOwnerPassword(password: string) { if (password.length < 8) return false; await writeState("owner-password-hash", await hashPassword(password)); return true; }

export async function createOwnerSession() {
  const token = crypto.randomUUID();
  await writeState(`owner-session:${token}`, { expiresAt: Date.now() + 1000 * 60 * 60 * 8 });
  return token;
}

export async function isOwnerRequest(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${OWNER_COOKIE}=`))?.split("=")[1];
  if (!token) return false;
  const session = await readState<{ expiresAt: number }>(`owner-session:${token}`);
  return Boolean(session && session.expiresAt > Date.now());
}

export async function changePassword(password: string) {
  await writeState(PASSWORD_KEY, await hashPassword(password));
}

export async function createAdminSession() {
  const token = crypto.randomUUID();
  await writeState(`${SESSION_PREFIX}${token}`, {
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });
  return token;
}

export async function createAdminSessionFor(username = "admin") {
  const token = crypto.randomUUID();
  const account = (await listAdminAccounts())[username.trim().toLowerCase()];
  await writeState(`${SESSION_PREFIX}${token}`, { username, passwordHash: account?.passwordHash, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14 });
  return token;
}

export async function isValidAdminToken(token: string | undefined) {
  if (!token) return false;
  const session = await readState<{ username?: string; passwordHash?: string; expiresAt: number }>(`${SESSION_PREFIX}${token}`);
  if (!session || session.expiresAt <= Date.now()) return false;
  if (session.username && session.passwordHash) {
    const account = (await listAdminAccounts())[session.username.trim().toLowerCase()];
    if (account && account.passwordHash !== session.passwordHash) return false;
  }
  return true;
}

export async function usernameFromToken(token: string | undefined) {
  if (!token) return null;
  const session = await readState<{ username?: string; expiresAt: number }>(`${SESSION_PREFIX}${token}`);
  return session && session.expiresAt > Date.now() ? session.username ?? "admin" : null;
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

export function scopedStateKey(base: string, username: string | null | undefined) {
  return `${base}:${encodeURIComponent(username || "legacy")}`;
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(SESSION_COOKIE)?.value))) {
    redirect("/admin/login");
  }
}

import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readState, writeState } from "./api/state-store";

const PASSWORD_KEY = "admin-password-hash";
const SESSION_PREFIX = "admin-session:";
export const SESSION_COOKIE = "pnn_admin_session";

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

export async function isValidAdminToken(token: string | undefined) {
  if (!token) return false;
  const session = await readState<{ expiresAt: number }>(`${SESSION_PREFIX}${token}`);
  return Boolean(session && session.expiresAt > Date.now());
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

export async function requireAdmin() {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(SESSION_COOKIE)?.value))) {
    redirect("/admin/login");
  }
}

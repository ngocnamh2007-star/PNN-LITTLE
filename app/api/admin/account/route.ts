import { adminUsernameFromRequest, deleteAdminAccount, findAdminAccount, listAdminAccounts, normalizePhone, SESSION_COOKIE, updateAdminAccountContact } from "../../../admin-auth";
import { loadEmailConfig, sendTransactionalEmail } from "../../email-service";
import { deleteState, readState, writeState } from "../../state-store";

type ContactOtp = { hash: string; expiresAt: number; attempts: number };

function otpKey(username: string) {
  return `admin-contact-otp:${encodeURIComponent(username.trim().toLowerCase())}`;
}

function randomOtp() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

async function hashOtp(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pnn-little-contact-otp:${value}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string) {
  return /^((\+84|0)(3|5|7|8|9)\d{8})$/.test(value);
}

async function contactConflict(username: string, email: string, phone: string) {
  const key = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  const accounts = await listAdminAccounts();
  return Object.values(accounts).some((account) => account.username.trim().toLowerCase() !== key && (account.email?.trim().toLowerCase() === normalizedEmail || normalizePhone(account.phone || "") === normalizedPhone));
}

export async function POST(request: Request) {
  const username = await adminUsernameFromRequest(request);
  if (!username) return Response.json({ error: "Phiên đăng nhập đã hết hạn" }, { status: 401 });
  const account = await findAdminAccount(username);
  if (!account?.email) return Response.json({ error: "Tài khoản chưa có email để nhận mã OTP" }, { status: 400 });
  const payload = (await request.json().catch(() => ({}))) as { email?: string; phone?: string };
  const email = payload.email?.trim().toLowerCase() || "";
  const phone = normalizePhone(payload.phone || "");
  if (!validEmail(email)) return Response.json({ error: "Vui lòng nhập email hợp lệ" }, { status: 400 });
  if (!validPhone(phone)) return Response.json({ error: "Vui lòng nhập số điện thoại hợp lệ" }, { status: 400 });
  if (await contactConflict(username, email, phone)) return Response.json({ error: "Email hoặc số điện thoại đã được tài khoản khác sử dụng" }, { status: 409 });
  const otp = randomOtp();
  await writeState(otpKey(username), { hash: await hashOtp(otp), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 } satisfies ContactOtp);
  const result = await sendTransactionalEmail(await loadEmailConfig(), {
    to: account.email,
    subject: "Mã OTP cập nhật thông tin tài khoản PNN-LITTLE",
    text: `Mã OTP của bạn là: ${otp}\n\nMã có hiệu lực trong 10 phút để xác nhận thay đổi email và số điện thoại tài khoản.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#fff1fb"><h2 style="color:#ffd1eb">Xác nhận cập nhật tài khoản</h2><p>Mã OTP của bạn là:</p><p style="padding:14px 16px;border:1px solid #ff61ad88;border-radius:12px;background:#35133f;color:#ff8fc7;font-size:28px;font-weight:800;letter-spacing:6px;text-align:center">${otp}</p><p>Mã có hiệu lực trong 10 phút.</p></div>`,
    params: { otp_code: otp, recipient_email: account.email },
  });
  if (!result.ok) {
    await deleteState(otpKey(username));
    return Response.json({ error: result.error || "Không thể gửi mã OTP" }, { status: 502 });
  }
  return Response.json({ ok: true, message: "Mã OTP đã được gửi về email hiện tại của tài khoản." });
}

export async function PATCH(request: Request) {
  const username = await adminUsernameFromRequest(request);
  if (!username) return Response.json({ error: "Phiên đăng nhập đã hết hạn" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { email?: string; phone?: string; otp?: string };
  const email = payload.email?.trim().toLowerCase() || "";
  const phone = normalizePhone(payload.phone || "");
  const otp = payload.otp?.trim() || "";
  if (!validEmail(email) || !validPhone(phone)) return Response.json({ error: "Email hoặc số điện thoại không hợp lệ" }, { status: 400 });
  const stored = await readState<ContactOtp>(otpKey(username));
  if (!stored || stored.expiresAt < Date.now()) return Response.json({ error: "Mã OTP đã hết hạn. Hãy yêu cầu mã mới." }, { status: 400 });
  if (stored.attempts >= 5) return Response.json({ error: "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã mới." }, { status: 400 });
  stored.attempts += 1;
  await writeState(otpKey(username), stored);
  if (!/^\d{6}$/.test(otp) || (await hashOtp(otp)) !== stored.hash) return Response.json({ error: "Mã OTP không đúng" }, { status: 400 });
  if (await contactConflict(username, email, phone)) return Response.json({ error: "Email hoặc số điện thoại đã được tài khoản khác sử dụng" }, { status: 409 });
  if (!(await updateAdminAccountContact(username, email, phone))) return Response.json({ error: "Không thể cập nhật thông tin tài khoản" }, { status: 400 });
  await deleteState(otpKey(username));
  return Response.json({ ok: true, message: "Đã cập nhật email và số điện thoại tài khoản." });
}

export async function DELETE(request: Request) {
  const username = await adminUsernameFromRequest(request);
  if (!username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await deleteAdminAccount(username);
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}

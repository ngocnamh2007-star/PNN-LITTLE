import { createAdminAccount, createAdminSessionFor, hasAdminAccount, SESSION_COOKIE } from "../../../admin-auth";

export async function GET() {
  return Response.json({ available: !(await hasAdminAccount()) });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { username?: string; email?: string; phone?: string; password?: string };
  if (!payload.username?.trim()) return Response.json({ error: "Vui lòng nhập họ và tên" }, { status: 400 });
  if (!payload.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return Response.json({ error: "Vui lòng nhập email hợp lệ" }, { status: 400 });
  const phone = (payload.phone || "").replace(/[\s().-]/g, "");
  if (!/^((\+84|0)(3|5|7|8|9)\d{8})$/.test(phone)) return Response.json({ error: "Vui lòng nhập số điện thoại hợp lệ" }, { status: 400 });
  if (!payload.password || payload.password.length < 8) return Response.json({ error: "Mật khẩu cần ít nhất 8 ký tự" }, { status: 400 });
  const fullName = payload.username.trim();
  try { await createAdminAccount(fullName, payload.password, payload.email, phone); }
  catch { return Response.json({ error: "Tài khoản đã tồn tại" }, { status: 409 }); }
  const token = await createAdminSessionFor(fullName, request);
  return Response.json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600` } });
}

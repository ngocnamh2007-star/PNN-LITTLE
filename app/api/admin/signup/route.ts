import { createAdminAccount, createAdminSessionFor, hasAdminAccount, SESSION_COOKIE } from "../../../admin-auth";

export async function GET() {
  return Response.json({ available: !(await hasAdminAccount()) });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { username?: string; password?: string };
  if (!payload.username?.trim()) return Response.json({ error: "Vui lòng nhập tên tài khoản" }, { status: 400 });
  if (!payload.password || payload.password.length < 8) return Response.json({ error: "Mật khẩu cần ít nhất 8 ký tự" }, { status: 400 });
  try { await createAdminAccount(payload.username, payload.password); }
  catch { return Response.json({ error: "Tài khoản đã tồn tại" }, { status: 409 }); }
  const token = await createAdminSessionFor(payload.username!.trim());
  return Response.json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600` } });
}

import { createAdminSessionFor, isAdminAccountDisabled, SESSION_COOKIE, verifyAdminCredentials } from "../../../admin-auth";

export async function POST(request: Request) {
  const payload = (await request.json()) as { username?: string; password?: string };
  if (payload.username && await isAdminAccountDisabled(payload.username)) {
    return Response.json({ error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên." }, { status: 423 });
  }
  if (!payload.password || !(await verifyAdminCredentials(payload.username || "admin", payload.password))) {
    return Response.json({ error: "Mật khẩu không đúng" }, { status: 401 });
  }
  const token = await createAdminSessionFor(payload.username || "admin");
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`,
    },
  });
}

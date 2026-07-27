import { createAdminSession, SESSION_COOKIE, verifyPassword } from "../../../admin-auth";

export async function POST(request: Request) {
  const payload = (await request.json()) as { password?: string };
  if (!payload.password || !(await verifyPassword(payload.password))) {
    return Response.json({ error: "Mật khẩu không đúng" }, { status: 401 });
  }
  const token = await createAdminSession();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`,
    },
  });
}

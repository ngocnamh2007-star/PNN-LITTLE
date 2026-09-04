import { adminUsernameFromRequest, deleteAdminAccount, SESSION_COOKIE } from "../../../admin-auth";

export async function DELETE(request: Request) {
  const username = await adminUsernameFromRequest(request);
  if (!username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await deleteAdminAccount(username);
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}

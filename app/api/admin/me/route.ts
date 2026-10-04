import { adminMustChangePassword, adminSessionFailureCode, adminSessionFromRequest, touchAdminSession } from "../../../admin-auth";

export async function GET(request: Request) {
  const session = await adminSessionFromRequest(request);
  if (!session) return Response.json({ error: "Phiên đăng nhập đã bị hủy", code: await adminSessionFailureCode(request) }, { status: 401 });
  const touched = await touchAdminSession(request);
  const username = touched?.username || session.username;
  return Response.json({ username, sessionId: touched?.id || session.id, mustChangePassword: await adminMustChangePassword(username) });
}

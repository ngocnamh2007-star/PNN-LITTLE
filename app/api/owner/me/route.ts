import { ownerSessionFromRequest, touchOwnerSession } from "../../../admin-auth";

export async function GET(request: Request) {
  const session = await ownerSessionFromRequest(request);
  if (!session) return Response.json({ error: "Phiên quản trị đã bị hủy", code: "SESSION_REVOKED" }, { status: 401 });
  const touched = await touchOwnerSession(request);
  return Response.json({ sessionId: touched?.id || session.id });
}

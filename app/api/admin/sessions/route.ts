import { adminSessionFromRequest, adminSessionIsActive, listAdminSessions, revokeAdminSession } from "../../../admin-auth";

export async function GET(request: Request) {
  const current = await adminSessionFromRequest(request);
  if (!current) return Response.json({ error: "Phiên đăng nhập đã bị hủy", code: "SESSION_REVOKED" }, { status: 401 });
  const sessions = await listAdminSessions(current.username);
  const result = await Promise.all(sessions
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(async (session) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      device: session.device,
      ip: session.ip,
      location: session.location || "Không xác định",
      active: await adminSessionIsActive(session),
      current: session.id === current.id,
    })));
  return Response.json({ sessions: result });
}

export async function DELETE(request: Request) {
  const current = await adminSessionFromRequest(request);
  if (!current) return Response.json({ error: "Phiên đăng nhập đã bị hủy", code: "SESSION_REVOKED" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!payload.sessionId) return Response.json({ error: "Thiếu thiết bị cần đăng xuất" }, { status: 400 });
  if (!(await revokeAdminSession(current.username, payload.sessionId))) return Response.json({ error: "Không tìm thấy phiên đăng nhập" }, { status: 404 });
  return Response.json({ ok: true, current: payload.sessionId === current.id });
}

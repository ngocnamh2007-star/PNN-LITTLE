import { adminSessionFromRequest, changeAdminPasswordFor, revokeAllAdminSessions, updateAdminSessionPassword, updateAllAdminSessionPasswords, verifyAdminPasswordFor } from "../../../admin-auth";

export async function POST(request: Request) {
  const session = await adminSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json()) as { currentPassword?: string; newPassword?: string; signOutOthers?: boolean };
  if (!payload.currentPassword || !(await verifyAdminPasswordFor(session.username, payload.currentPassword))) {
    return Response.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
  }
  if (!payload.newPassword || payload.newPassword.length < 8) {
    return Response.json({ error: "Mật khẩu mới cần ít nhất 8 ký tự" }, { status: 400 });
  }
  const passwordHash = await changeAdminPasswordFor(session.username, payload.newPassword);
  if (payload.signOutOthers === false) await updateAllAdminSessionPasswords(session.username, passwordHash);
  else {
    await revokeAllAdminSessions(session.username, session.id);
    await updateAdminSessionPassword(session.username, session.id, passwordHash);
  }
  return Response.json({ ok: true, revokedOtherSessions: payload.signOutOthers !== false });
}

import { changePassword, isAdminRequest, verifyPassword } from "../../../admin-auth";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json()) as { currentPassword?: string; newPassword?: string };
  if (!payload.currentPassword || !(await verifyPassword(payload.currentPassword))) {
    return Response.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
  }
  if (!payload.newPassword || payload.newPassword.length < 8) {
    return Response.json({ error: "Mật khẩu mới cần ít nhất 8 ký tự" }, { status: 400 });
  }
  await changePassword(payload.newPassword);
  return Response.json({ ok: true });
}

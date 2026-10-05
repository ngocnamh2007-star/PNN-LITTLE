import { isOwnerRequest, listAdminAccounts } from "../../../admin-auth";
import { loadEmailConfig, sendTransactionalEmail } from "../../email-service";

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] || character)).replace(/\n/g, "<br>");
}

export async function POST(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { username?: string; subject?: string; message?: string };
  const username = payload.username?.trim().toLowerCase() || "";
  const subject = payload.subject?.trim() || "";
  const message = payload.message?.trim() || "";
  if (!username || !subject || !message) return Response.json({ error: "Vui lòng chọn khách hàng và nhập đủ tiêu đề, nội dung" }, { status: 400 });
  if (subject.length > 180) return Response.json({ error: "Tiêu đề email quá dài" }, { status: 400 });
  if (message.length > 12000) return Response.json({ error: "Nội dung email quá dài" }, { status: 400 });

  const accounts = await listAdminAccounts();
  const account = accounts[username];
  if (!account?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) return Response.json({ error: "Tài khoản này chưa có email hợp lệ" }, { status: 400 });
  const result = await sendTransactionalEmail(await loadEmailConfig(), {
    to: account.email,
    subject,
    text: message,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#231327"><h2>PNN-LITTLE</h2><p>${escapeHtml(message)}</p></div>`,
    params: { recipient_email: account.email },
  });
  if (!result.ok) return Response.json({ error: result.error || "Không thể gửi email này" }, { status: 502 });
  return Response.json({ ok: true, message: result.id ? `Email đã được gửi (mã ${result.id}).` : "Email đã được gửi." });
}

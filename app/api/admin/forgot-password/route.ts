import { findAdminAccountByEmail, resetAdminPasswordByEmail, revokeAllAdminSessions } from "../../../admin-auth";
import { loadEmailConfig, sendTransactionalEmail } from "../../email-service";

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { email?: string };
  const email = payload.email?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Vui lòng nhập email hợp lệ" }, { status: 400 });
  const account = await findAdminAccountByEmail(email);
  if (!account) return Response.json({ ok: true, message: "Nếu email đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email đó." });

  const password = temporaryPassword();
  const result = await sendTransactionalEmail(await loadEmailConfig(), {
    to: account.email,
    subject: "Mật khẩu tạm thời cho PNN-LITTLE",
    text: `Mật khẩu tạm thời của bạn là: ${password}\n\nVui lòng đăng nhập lại và đổi mật khẩu mới ngay khi truy cập tài khoản. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy liên hệ quản trị viên.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#231327"><h2>PNN-LITTLE</h2><p>Mật khẩu tạm thời của bạn là:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${password}</p><p>Vui lòng đăng nhập lại và đổi mật khẩu mới ngay khi truy cập tài khoản.</p><p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy liên hệ quản trị viên.</p></div>`,
    params: { temporary_password: password, recipient_email: account.email },
  });
  if (!result.ok) return Response.json({ error: result.error || "Không thể gửi email lúc này. Vui lòng thử lại sau." }, { status: 502 });

  await resetAdminPasswordByEmail(email, password);
  await revokeAllAdminSessions(account.username);
  return Response.json({ ok: true, message: "Mật khẩu tạm thời đã được gửi tới email của bạn." });
}

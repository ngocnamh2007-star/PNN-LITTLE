import { env } from "cloudflare:workers";
import { findAdminAccountByEmail, resetAdminPasswordByEmail, revokeAllAdminSessions } from "../../../admin-auth";

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

  const runtime = env as unknown as Record<string, unknown>;
  const apiKey = typeof runtime.RESEND_API_KEY === "string" ? runtime.RESEND_API_KEY : "";
  const from = typeof runtime.RESET_EMAIL_FROM === "string" && runtime.RESET_EMAIL_FROM ? runtime.RESET_EMAIL_FROM : "PNN-LITTLE <onboarding@resend.dev>";
  if (!apiKey) return Response.json({ error: "Hệ thống chưa cấu hình dịch vụ gửi email. Vui lòng liên hệ quản trị viên." }, { status: 503 });

  const password = temporaryPassword();
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [account.email],
      subject: "Mật khẩu tạm thời cho PNN-LITTLE",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#231327"><h2>PNN-LITTLE</h2><p>Mật khẩu tạm thời của bạn là:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${password}</p><p>Vui lòng đăng nhập lại và đổi mật khẩu mới ngay khi truy cập tài khoản.</p><p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy liên hệ quản trị viên.</p></div>`,
    }),
  });
  if (!emailResponse.ok) return Response.json({ error: "Không thể gửi email lúc này. Vui lòng thử lại sau." }, { status: 502 });

  await resetAdminPasswordByEmail(email, password);
  await revokeAllAdminSessions(account.username);
  return Response.json({ ok: true, message: "Mật khẩu tạm thời đã được gửi tới email của bạn." });
}

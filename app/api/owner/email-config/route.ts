import { isOwnerRequest } from "../../../admin-auth";
import { loadEmailConfig, publicEmailConfig, sendTransactionalEmail } from "../../email-service";
import { writeState } from "../../state-store";

export async function GET(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ config: publicEmailConfig(await loadEmailConfig()) });
}

export async function PUT(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { provider?: string; from?: string; apiKey?: string; serviceId?: string; templateId?: string; publicKey?: string; privateKey?: string };
  const current = await loadEmailConfig();
  const provider = payload.provider === "emailjs" ? "emailjs" : "resend";
  const from = payload.from?.trim() || current.from;
  const next = {
    provider,
    from,
    apiKey: payload.apiKey?.trim() || current.apiKey,
    serviceId: payload.serviceId?.trim() || current.serviceId,
    templateId: payload.templateId?.trim() || current.templateId,
    publicKey: payload.publicKey?.trim() || current.publicKey,
    privateKey: payload.privateKey?.trim() || current.privateKey,
  } as const;
  if (provider === "resend" && !next.from) return Response.json({ error: "Vui lòng nhập email người gửi" }, { status: 400 });
  await writeState("email-config", next);
  return Response.json({ ok: true, config: publicEmailConfig(next) });
}

export async function POST(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { to?: string };
  const to = payload.to?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Response.json({ error: "Vui lòng nhập email nhận thư hợp lệ" }, { status: 400 });
  const result = await sendTransactionalEmail(await loadEmailConfig(), {
    to,
    subject: "Email kiểm tra PNN-LITTLE",
    text: "Email gửi thử đã hoạt động. Chức năng quên mật khẩu và gửi email cho khách hàng có thể sử dụng.",
    html: "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#231327\"><h2>PNN-LITTLE</h2><p>Email gửi thử đã hoạt động. Chức năng quên mật khẩu và gửi email cho khách hàng có thể sử dụng.</p></div>",
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
  return Response.json({ ok: true, message: result.id ? `Email kiểm tra đã được gửi (mã ${result.id}). Hãy kiểm tra Inbox/Spam.` : "Email kiểm tra đã được gửi." });
}

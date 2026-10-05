import { env } from "cloudflare:workers";
import { isOwnerRequest } from "../../../admin-auth";
import { readState, writeState } from "../../state-store";

const KEY = "email-config";
const DEFAULT_FROM = "PNN-LITTLE <onboarding@resend.dev>";

type EmailConfig = {
  provider: "resend";
  apiKey: string;
  from: string;
};

function runtimeSecrets() {
  const runtime = env as unknown as Record<string, unknown>;
  return {
    apiKey: typeof runtime.RESEND_API_KEY === "string" ? runtime.RESEND_API_KEY : "",
    from: typeof runtime.RESET_EMAIL_FROM === "string" && runtime.RESET_EMAIL_FROM ? runtime.RESET_EMAIL_FROM : DEFAULT_FROM,
  };
}

async function storedConfig(): Promise<EmailConfig> {
  const saved = await readState<Partial<EmailConfig>>(KEY);
  const secrets = runtimeSecrets();
  return {
    provider: "resend",
    apiKey: saved?.apiKey || secrets.apiKey,
    from: saved?.from || secrets.from,
  };
}

function publicConfig(config: EmailConfig) {
  return { provider: config.provider, from: config.from, hasApiKey: Boolean(config.apiKey) };
}

async function sendResendEmail(config: EmailConfig, to: string) {
  if (!config.apiKey) return { ok: false, error: "Chưa có API key Resend" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: "Email kiểm tra PNN-LITTLE",
      html: "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#231327\"><h2>PNN-LITTLE</h2><p>Email gửi thử đã hoạt động. Chức năng quên mật khẩu có thể gửi mật khẩu tạm thời tới khách hàng.</p></div>",
    }),
  });
  if (!response.ok) return { ok: false, error: "Resend từ chối email. Hãy kiểm tra API key và email người gửi." };
  return { ok: true };
}

export async function GET(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ config: publicConfig(await storedConfig()) });
}

export async function PUT(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { provider?: string; apiKey?: string; from?: string };
  const current = await storedConfig();
  const from = payload.from?.trim() || current.from;
  if (payload.provider && payload.provider !== "resend") return Response.json({ error: "Hiện chỉ hỗ trợ Resend" }, { status: 400 });
  if (!from) return Response.json({ error: "Vui lòng nhập email người gửi" }, { status: 400 });
  const apiKey = payload.apiKey?.trim() || current.apiKey;
  await writeState(KEY, { provider: "resend", apiKey, from });
  return Response.json({ ok: true, config: publicConfig({ provider: "resend", apiKey, from }) });
}

export async function POST(request: Request) {
  if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { to?: string };
  const to = payload.to?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Response.json({ error: "Vui lòng nhập email nhận thư hợp lệ" }, { status: 400 });
  const result = await sendResendEmail(await storedConfig(), to);
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
  return Response.json({ ok: true, message: "Email kiểm tra đã được gửi." });
}

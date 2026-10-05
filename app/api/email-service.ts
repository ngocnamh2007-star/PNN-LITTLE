import { env } from "cloudflare:workers";
import { readState } from "./state-store";

export type EmailProvider = "resend" | "emailjs";
export type EmailConfig = {
  provider: EmailProvider;
  from: string;
  apiKey: string;
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
};

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  params?: Record<string, string>;
};

const DEFAULT_FROM = "PNN-LITTLE <onboarding@resend.dev>";

export async function loadEmailConfig(): Promise<EmailConfig> {
  const saved = await readState<Partial<EmailConfig>>("email-config");
  const runtime = env as unknown as Record<string, unknown>;
  return {
    provider: saved?.provider === "emailjs" ? "emailjs" : "resend",
    from: saved?.from || (typeof runtime.RESET_EMAIL_FROM === "string" && runtime.RESET_EMAIL_FROM ? runtime.RESET_EMAIL_FROM : DEFAULT_FROM),
    apiKey: saved?.apiKey || (typeof runtime.RESEND_API_KEY === "string" ? runtime.RESEND_API_KEY : ""),
    serviceId: saved?.serviceId || (typeof runtime.EMAILJS_SERVICE_ID === "string" ? runtime.EMAILJS_SERVICE_ID : ""),
    templateId: saved?.templateId || (typeof runtime.EMAILJS_TEMPLATE_ID === "string" ? runtime.EMAILJS_TEMPLATE_ID : ""),
    publicKey: saved?.publicKey || (typeof runtime.EMAILJS_PUBLIC_KEY === "string" ? runtime.EMAILJS_PUBLIC_KEY : ""),
    privateKey: saved?.privateKey || (typeof runtime.EMAILJS_PRIVATE_KEY === "string" ? runtime.EMAILJS_PRIVATE_KEY : ""),
  };
}

export function publicEmailConfig(config: EmailConfig) {
  return {
    provider: config.provider,
    from: config.from,
    hasApiKey: Boolean(config.apiKey),
    serviceId: config.serviceId,
    templateId: config.templateId,
    publicKey: config.publicKey,
    hasPrivateKey: Boolean(config.privateKey),
  };
}

function senderParts(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || "PNN-LITTLE", email: match[2].trim() } : { name: "PNN-LITTLE", email: from.trim() };
}

export async function sendTransactionalEmail(config: EmailConfig, payload: EmailPayload) {
  if (config.provider === "emailjs") {
    if (!config.serviceId || !config.templateId || !config.publicKey || !config.privateKey) return { ok: false, error: "EmailJS chưa đủ Service ID, Template ID, Public Key và Private Key" };
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        accessToken: config.privateKey,
        template_params: {
          ...(payload.params || {}),
          to_email: payload.to,
          subject: payload.subject,
          message: payload.text,
          html_content: payload.html,
        },
      }),
    });
    const body = await response.text();
    if (!response.ok) return { ok: false, error: body || "EmailJS không thể gửi email" };
    return { ok: true, id: body || "EmailJS" };
  }

  if (!config.apiKey) return { ok: false, error: "Chưa có API key Resend" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: config.from, to: [payload.to], subject: payload.subject, text: payload.text, html: payload.html }),
  });
  const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) return { ok: false, error: result.message || "Resend từ chối email" };
  return { ok: true, id: result.id || "Resend" };
}

export { DEFAULT_FROM, senderParts };

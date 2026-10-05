"use client";

import { useEffect, useState } from "react";

type Account = { username: string; email: string; disabled: boolean };
type Social = { id: number; name: string; url: string };
type Info = Record<string, string>;
type EmailConfig = { provider: "resend" | "emailjs"; from: string; hasApiKey: boolean; serviceId: string; templateId: string; publicKey: string; hasPrivateKey: boolean };

const empty: Info = {
  intro: "", contact: "", address: "", phone: "", facebook: "", twitter: "", socialLinks: "", links: "",
  landingEyebrow: "", landingTitle: "", landingAccent: "", landingLead: "", featureOneTitle: "", featureOneText: "",
  featureTwoTitle: "", featureTwoText: "", featureThreeTitle: "", featureThreeText: "",
};
const icon = (name: string) => ({ Facebook: "f", Instagram: "◎", TikTok: "♪", YouTube: "▶", Zalo: "Z", LinkedIn: "in" }[name] || "↗");

export default function OwnerClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [info, setInfo] = useState<Info>(empty);
  const [socials, setSocials] = useState<Social[]>([]);
  const [message, setMessage] = useState("");
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({ provider: "resend", from: "", hasApiKey: false, serviceId: "", templateId: "", publicKey: "", hasPrivateKey: false });
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailServiceId, setEmailServiceId] = useState("");
  const [emailTemplateId, setEmailTemplateId] = useState("");
  const [emailPublicKey, setEmailPublicKey] = useState("");
  const [emailPrivateKey, setEmailPrivateKey] = useState("");
  const [showEmailPrivateKey, setShowEmailPrivateKey] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [showEmailApiKey, setShowEmailApiKey] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailMessage, setMailMessage] = useState("");
  const [mailSending, setMailSending] = useState(false);

  async function load() {
    const [accountsResponse, infoResponse, emailResponse] = await Promise.all([
      fetch("/api/owner/accounts"),
      fetch("/api/site-info"),
      fetch("/api/owner/email-config"),
    ]);
    if (accountsResponse.ok) setAccounts(((await accountsResponse.json()) as { accounts: Account[] }).accounts);
    if (infoResponse.ok) {
      const data = (await infoResponse.json()) as { info: Info };
      setInfo(data.info);
      setSocials((data.info.socialLinks || "").split("\n").map((line, id) => {
        const [name, ...parts] = line.split("|");
        return { id, name: name.trim(), url: parts.join("|").trim() };
      }).filter((social) => social.name));
    }
    if (emailResponse.ok) {
      const config = ((await emailResponse.json()) as { config: EmailConfig }).config;
      setEmailConfig(config);
      setEmailServiceId(config.serviceId || "");
      setEmailTemplateId(config.templateId || "");
      setEmailPublicKey(config.publicKey || "");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void fetch("/api/owner/me", { cache: "no-store" }).then(async (response) => {
        if (response.status !== 401) return;
        const data = (await response.json().catch(() => ({}))) as { code?: string };
        window.location.href = data.code === "PASSWORD_CHANGED" ? "/owner/login?session=revoked" : "/owner/login?session=revoked";
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  async function save() {
    const next = { ...info, socialLinks: socials.filter((social) => social.name.trim()).map((social) => `${social.name.trim()} | ${social.url.trim()}`).join("\n") };
    const response = await fetch("/api/site-info", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    setMessage(response.ok ? "Đã lưu thông tin thành công" : "Không thể lưu thông tin");
  }

  async function saveEmailConfig() {
    setEmailSaving(true);
    setEmailMessage("");
    const response = await fetch("/api/owner/email-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: emailConfig.provider, from: emailConfig.from, apiKey: emailApiKey || undefined, serviceId: emailServiceId || undefined, templateId: emailTemplateId || undefined, publicKey: emailPublicKey || undefined, privateKey: emailPrivateKey || undefined }),
    });
    const data = (await response.json().catch(() => ({}))) as { config?: EmailConfig; error?: string };
    if (response.ok && data.config) {
      setEmailConfig(data.config);
      setEmailApiKey("");
      setEmailPrivateKey("");
      setEmailServiceId(data.config.serviceId || "");
      setEmailTemplateId(data.config.templateId || "");
      setEmailPublicKey(data.config.publicKey || "");
      setEmailMessage("Đã lưu cấu hình email. API key được bảo mật và không hiển thị lại.");
    } else setEmailMessage(data.error || "Không thể lưu cấu hình email");
    setEmailSaving(false);
  }

  async function sendTestEmail() {
    setEmailTesting(true);
    setEmailMessage("");
    const response = await fetch("/api/owner/email-config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: testEmail }) });
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setEmailMessage(data.message || data.error || "Không thể gửi email kiểm tra");
    setEmailTesting(false);
  }

  async function sendCustomerEmail() {
    setMailSending(true);
    setMailMessage("");
    const response = await fetch("/api/owner/email-send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: mailTo, subject: mailSubject, message: mailBody }) });
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setMailMessage(data.message || data.error || "Không thể gửi email");
    setMailSending(false);
  }

  async function accountAction(username: string, body: object) {
    await fetch("/api/owner/accounts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, ...body }) });
    await load();
  }

  async function logout() {
    await fetch("/api/owner/logout", { method: "POST" });
    window.location.href = "/owner/login";
  }

  const field = (key: string, label: string, area = false) => (
    <label className={`admin-field ${key === "facebook" || key === "twitter" ? "legacy-social-field" : ""}`}>
      <span>{label}</span>
      {area ? <textarea value={info[key] || ""} onChange={(event) => setInfo({ ...info, [key]: event.target.value })} /> : <input value={info[key] || ""} onChange={(event) => setInfo({ ...info, [key]: event.target.value })} />}
    </label>
  );

  return <main className="admin-page">
    <header className="admin-header"><div><p className="eyebrow">PNN LITTLE</p><h1>Quản trị hệ thống</h1><p>Tổng số khách hàng: <strong>{accounts.length}</strong></p></div><button onClick={() => void logout()}>Đăng xuất</button></header>

    <section className="admin-panel owner-accounts">
      <h2>Tài khoản khách hàng</h2>
      {accounts.map((account) => <div className="owner-account" key={account.username}><span className={account.disabled ? "status-dot offline" : "status-dot"} /><strong>{account.username}</strong><span>{account.disabled ? "Đã khóa" : "Đang sử dụng"}</span><button onClick={() => void accountAction(account.username, { disabled: !account.disabled })}>{account.disabled ? "Mở khóa" : "Khóa"}</button><button onClick={() => { const password = prompt("Mật khẩu mới (ít nhất 8 ký tự):"); if (password) void accountAction(account.username, { password }); }}>Đổi mật khẩu</button><button className="delete-account-button" onClick={async () => { if (confirm(`Xóa tài khoản ${account.username}?`)) { await fetch(`/api/owner/accounts?username=${encodeURIComponent(account.username)}`, { method: "DELETE" }); await load(); } }}>Xóa</button></div>)}
    </section>

    <section className="admin-panel owner-accounts email-config-panel">
      <h2>Thiết lập email khôi phục mật khẩu</h2>
      <p className="panel-note">Cài đặt một lần tại đây để khách hàng nhận mật khẩu tạm thời khi bấm “Quên mật khẩu?” hoặc khi bạn gửi email thủ công.</p>
      <label className="admin-field"><span>Dịch vụ gửi email</span><select value={emailConfig.provider} onChange={(event) => setEmailConfig({ ...emailConfig, provider: event.target.value as "resend" | "emailjs" })}><option value="emailjs">EmailJS</option><option value="resend">Resend</option></select></label>
      {emailConfig.provider === "emailjs" ? <>
        <label className="admin-field"><span>EmailJS Service ID</span><input value={emailServiceId} onChange={(event) => setEmailServiceId(event.target.value)} placeholder="service_xxxxxxx" /></label>
        <label className="admin-field"><span>EmailJS Template ID</span><input value={emailTemplateId} onChange={(event) => setEmailTemplateId(event.target.value)} placeholder="template_xxxxxxx" /></label>
        <label className="admin-field"><span>EmailJS Public Key</span><input value={emailPublicKey} onChange={(event) => setEmailPublicKey(event.target.value)} placeholder="Public key trong Account" /></label>
        <label className="admin-field"><span>EmailJS Private Key</span><div className="password-input-wrap"><input type={showEmailPrivateKey ? "text" : "password"} value={emailPrivateKey} onChange={(event) => setEmailPrivateKey(event.target.value)} placeholder={emailConfig.hasPrivateKey ? "Đã lưu — để trống nếu không đổi" : "Private key trong Account > Security"} /><button type="button" aria-label={showEmailPrivateKey ? "Ẩn private key" : "Hiện private key"} onClick={() => setShowEmailPrivateKey(!showEmailPrivateKey)}>{showEmailPrivateKey ? "◉" : "◌"}</button></div></label>
        <p className="panel-note">Trong template EmailJS, đặt To Email = <code>&#123;&#123;to_email&#125;&#125;</code>, Subject = <code>&#123;&#123;subject&#125;&#125;</code>, nội dung = <code>&#123;&#123;message&#125;&#125;</code>; email quên mật khẩu dùng thêm <code>&#123;&#123;temporary_password&#125;&#125;</code>.</p>
      </> : <label className="admin-field"><span>API key Resend</span><div className="password-input-wrap"><input type={showEmailApiKey ? "text" : "password"} value={emailApiKey} onChange={(event) => setEmailApiKey(event.target.value)} placeholder={emailConfig.hasApiKey ? "Đã lưu — để trống nếu không đổi" : "re_..."} /><button type="button" aria-label={showEmailApiKey ? "Ẩn API key" : "Hiện API key"} onClick={() => setShowEmailApiKey(!showEmailApiKey)}>{showEmailApiKey ? "◉" : "◌"}</button></div></label>}
      <label className="admin-field"><span>Email người gửi (Resend) / email mặc định của template (EmailJS)</span><input type="text" value={emailConfig.from} onChange={(event) => setEmailConfig({ ...emailConfig, from: event.target.value })} placeholder="PNN-LITTLE <hello@tenmiencuaban.com>" /></label>
      <label className="admin-field"><span>Email nhận thư kiểm tra</span><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Nhập email của bạn để thử gửi" /></label>
      <div className="email-config-actions"><button className="save-button" type="button" onClick={() => void saveEmailConfig()} disabled={emailSaving}>{emailSaving ? "Đang lưu..." : "Lưu cấu hình email"}</button><button className="reset-button" type="button" onClick={() => void sendTestEmail()} disabled={emailTesting}>{emailTesting ? "Đang gửi..." : "Gửi email kiểm tra"}</button></div>
      {emailMessage && <p className="save-status" aria-live="polite">{emailMessage}</p>}
    </section>

    <section className="admin-panel owner-accounts email-send-panel">
      <h2>Gửi email cho khách hàng</h2>
      <p className="panel-note">Chọn một tài khoản để gửi thông báo, hướng dẫn hoặc lời nhắn trực tiếp tới email đã đăng ký.</p>
      <label className="admin-field"><span>Khách hàng nhận email</span><select value={mailTo} onChange={(event) => setMailTo(event.target.value)}><option value="">-- Chọn khách hàng --</option>{accounts.map((account) => <option key={account.username} value={account.username}>{account.username} — {account.email || "Chưa có email"}{account.disabled ? " (đã khóa)" : ""}</option>)}</select></label>
      <label className="admin-field"><span>Tiêu đề email</span><input value={mailSubject} onChange={(event) => setMailSubject(event.target.value)} placeholder="Thông báo từ PNN-LITTLE" maxLength={180} /></label>
      <label className="admin-field"><span>Nội dung email</span><textarea value={mailBody} onChange={(event) => setMailBody(event.target.value)} placeholder="Nhập nội dung muốn gửi cho khách hàng..." maxLength={12000} /></label>
      <button className="save-button" type="button" onClick={() => void sendCustomerEmail()} disabled={mailSending}>{mailSending ? "Đang gửi..." : "Gửi email cho khách hàng"}</button>
      {mailMessage && <p className="save-status" aria-live="polite">{mailMessage}</p>}
    </section>

    <section className="admin-panel owner-accounts"><h2>Giới thiệu & liên hệ footer</h2>{field("intro", "Giới thiệu", true)}{field("links", "Liên kết nhanh (mỗi dòng một mục)", true)}{field("address", "Địa chỉ")}{field("phone", "Điện thoại")}{field("contact", "Email")}{field("facebook", "Facebook")}{field("twitter", "Twitter / X")}<h3 className="owner-subtitle">Mạng xã hội</h3>{socials.map((social, index) => <div className="social-editor" key={social.id}><span className="social-icon">{icon(social.name)}</span><input placeholder="Tên mạng xã hội" value={social.name} onChange={(event) => setSocials(socials.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input placeholder="https://..." value={social.url} onChange={(event) => setSocials(socials.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} /><button type="button" onClick={() => setSocials(socials.filter((item) => item.id !== social.id))}>Xóa</button></div>)}<button type="button" className="add-line" onClick={() => setSocials([...socials, { id: Date.now(), name: "", url: "" }])}>+ Thêm mạng xã hội</button><h3 className="owner-subtitle">Nội dung trang giới thiệu</h3>{field("landingEyebrow", "Dòng nhỏ phía trên")}{field("landingTitle", "Tiêu đề chính")}{field("landingAccent", "Dòng tiêu đề nổi bật")}{field("landingLead", "Mô tả trang", true)}{field("featureOneTitle", "Tính năng 1 - tiêu đề")}{field("featureOneText", "Tính năng 1 - mô tả", true)}{field("featureTwoTitle", "Tính năng 2 - tiêu đề")}{field("featureTwoText", "Tính năng 2 - mô tả", true)}{field("featureThreeTitle", "Tính năng 3 - tiêu đề")}{field("featureThreeText", "Tính năng 3 - mô tả", true)}<button className="save-button" type="button" onClick={() => void save()}>Lưu tất cả thay đổi</button>{message && <p className="save-status">{message}</p>}</section>
  </main>;
}

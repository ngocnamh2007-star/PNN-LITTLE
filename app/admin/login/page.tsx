"use client";

import { FormEvent, useEffect, useState } from "react";

type SiteInfo = { intro: string; contact: string; address: string; phone: string; facebook: string; twitter: string; socialLinks: string };

export default function AdminLoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [info, setInfo] = useState<SiteInfo>({ intro: "", contact: "", address: "", phone: "", facebook: "", twitter: "", socialLinks: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    if (params.get("locked") === "1") setError("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
    if (params.get("session") === "revoked") setError("Tài khoản đã bị đăng xuất trên thiết bị này.");
  }, []);
  useEffect(() => { void fetch("/api/site-info").then((r) => r.json()).then((data) => setInfo(data.info)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch(mode === "signup" ? "/api/admin/signup" : "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, email, phone, password }) });
    if (response.ok) window.location.href = "/admin";
    else { const payload = (await response.json()) as { error?: string }; setError(payload.error || "Không thể đăng nhập"); setLoading(false); }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    const response = await fetch("/api/admin/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: forgotEmail }) });
    const payload = (await response.json()) as { message?: string; error?: string };
    setForgotMessage(payload.message || payload.error || "Không thể gửi email lúc này");
    setForgotLoading(false);
  }

  return (
    <main className="admin-login-page"><div>
      <form className="admin-login-card" onSubmit={submit}>
        <div className="login-lock">♥</div><p className="eyebrow">PNN LITTLE</p>
        <h1>{mode === "signup" ? "Tạo tài khoản" : "Trang quản lý"}</h1>
        <p>{mode === "signup" ? "Tạo tài khoản riêng để bảo vệ trang quản lý." : "Đăng nhập để chỉnh sửa món quà."}</p>
        <label><span>{mode === "signup" ? "Tài khoản đăng nhập (email hoặc số điện thoại)" : "Email / số điện thoại"}</span><input value={username} autoComplete="username" placeholder="Nhập email hoặc số điện thoại" onChange={(event) => setUsername(event.target.value)} autoFocus /></label>
        {mode === "signup" && <><label><span>Email nhận khôi phục mật khẩu</span><input type="email" value={email} autoComplete="email" placeholder="ban@email.com" onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Số điện thoại</span><input type="tel" value={phone} autoComplete="tel" placeholder="09xxxxxxxx" onChange={(event) => setPhone(event.target.value)} required /></label></>}
        <label><span>Mật khẩu</span><div className="password-input-wrap"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "◉" : "◌"}</button></div></label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Đang xử lý..." : mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}</button>
        {mode === "login" && <button type="button" className="login-switch forgot-password-link" onClick={() => { setForgotOpen(true); setForgotMessage(""); }}>Quên mật khẩu?</button>}
        <button type="button" className="login-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Tạo tài khoản mới" : "Đã có tài khoản? Đăng nhập"}</button>
      </form>
      {forgotOpen && <div className="password-modal-backdrop" onClick={() => setForgotOpen(false)}><section className="admin-panel password-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="password-modal-close" onClick={() => setForgotOpen(false)} aria-label="Đóng">×</button><h2>Quên mật khẩu</h2><p>Nhập email đã đăng ký. Mật khẩu tạm thời gồm 8 ký tự sẽ được gửi tới email này.</p><form onSubmit={requestReset}><label className="admin-field"><span>Email đã đăng ký</span><input type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} required autoFocus /></label><button className="save-button" type="submit" disabled={forgotLoading}>{forgotLoading ? "Đang gửi..." : "Gửi mật khẩu mới"}</button></form>{forgotMessage && <p className="save-status" aria-live="polite">{forgotMessage}</p>}</section></div>}
      <footer className="login-footer"><strong>PNN-LITTLE</strong><span>{info.intro}</span><span>☎ {info.phone || info.contact}</span><div className="login-socials">{(info.socialLinks || `Facebook | ${info.facebook}\nTwitter / X | ${info.twitter}`).split("\n").filter(Boolean).map((line) => { const [name, ...parts] = line.split("|"); const url = parts.join("|").trim(); return <a key={line} href={url || undefined} target="_blank" rel="noreferrer">{name.trim()} ↗</a>; })}</div></footer>
    </div></main>
  );
}

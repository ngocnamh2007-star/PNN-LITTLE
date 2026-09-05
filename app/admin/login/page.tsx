"use client";

import { FormEvent, useEffect, useState } from "react";

export default function AdminLoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ intro: string; contact: string; address: string; phone: string; facebook: string; twitter: string }>({ intro: "", contact: "", address: "", phone: "", facebook: "", twitter: "" });
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup"); }, []);
  useEffect(() => { void fetch("/api/site-info").then((r) => r.json()).then((data) => setInfo(data.info)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch(mode === "signup" ? "/api/admin/signup" : "/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) window.location.href = "/admin";
    else {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Không thể đăng nhập");
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page"><div>
      <form className="admin-login-card" onSubmit={submit}>
        <div className="login-lock">♥</div>
        <p className="eyebrow">PNN LITTLE</p>
        <h1>{mode === "signup" ? "Tạo tài khoản" : "Trang quản lý"}</h1>
        <p>{mode === "signup" ? "Tạo tài khoản riêng để bảo vệ trang quản lý." : "Đăng nhập để chỉnh sửa món quà."}</p>
        <label><span>{mode === "signup" ? "Email hoặc số điện thoại" : "Email / số điện thoại"}</span><input value={username} autoComplete="username" placeholder={mode === "signup" ? "vd: ban@email.com hoặc 09xxxxxxxx" : "Nhập tài khoản của bạn"} onChange={(event) => setUsername(event.target.value)} autoFocus /></label>
        <label>
          <span>Mật khẩu</span>
          <div className="password-input-wrap"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "◉" : "◌"}</button></div>
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Đang xử lý..." : mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}</button>
        <button type="button" className="login-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Tạo tài khoản mới" : "Đã có tài khoản? Đăng nhập"}</button>
      </form><footer className="login-footer"><strong>PNN-LITTLE</strong><span>{info.intro}</span><span>☎ {info.phone || info.contact}</span><span>Facebook: {info.facebook || "Đang cập nhật"}</span></footer></div>
    </main>
  );
}

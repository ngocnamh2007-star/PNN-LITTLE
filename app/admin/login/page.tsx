"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="login-lock">♥</div>
        <p className="eyebrow">PNN LITTLE</p>
        <h1>{mode === "signup" ? "Tạo tài khoản" : "Trang quản lý"}</h1>
        <p>{mode === "signup" ? "Tạo tài khoản riêng để bảo vệ trang quản lý." : "Đăng nhập để chỉnh sửa món quà."}</p>
        <label><span>Tên tài khoản</span><input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} autoFocus /></label>
        <label>
          <span>Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Đang xử lý..." : mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}</button>
        <button type="button" className="login-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Tạo tài khoản mới" : "Đã có tài khoản? Đăng nhập"}</button>
        <a href="/">← Quay về trang món quà</a>
      </form>
    </main>
  );
}

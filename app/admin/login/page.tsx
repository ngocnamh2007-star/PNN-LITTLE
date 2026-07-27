"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
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
        <h1>Trang quản lý</h1>
        <p>Nhập mật khẩu riêng để chỉnh sửa món quà.</p>
        <label>
          <span>Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Đang kiểm tra..." : "Đăng nhập"}</button>
        <a href="/">← Quay về trang món quà</a>
      </form>
    </main>
  );
}

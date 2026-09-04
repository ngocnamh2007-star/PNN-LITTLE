"use client";
import { FormEvent, useState } from "react";

export default function OwnerLogin() {
  const [password, setPassword] = useState(""); const [show, setShow] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/owner/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); if (response.ok) window.location.href = "/owner"; else { setError("Mật khẩu quản trị không đúng"); } }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><div className="login-lock">♥</div><p className="eyebrow">PNN LITTLE</p><h1>Quản trị hệ thống</h1><p>Quản lý tài khoản khách hàng.</p><label><span>Mật khẩu quản trị</span><div className="password-input-wrap"><input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /><button type="button" onClick={() => setShow(!show)} aria-label="Hiện hoặc ẩn mật khẩu">👁</button></div></label>{error && <div className="login-error">{error}</div>}<button type="submit">Đăng nhập</button></form></main>;
}

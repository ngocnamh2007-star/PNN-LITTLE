"use client";

import { useEffect, useState } from "react";

export default function AdminAccountDetailsModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"edit" | "otp">("edit");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const openModal = () => {
      setMessage("");
      setStep("edit");
      setOtp("");
      setOpen(true);
      void fetch("/api/admin/me", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data: { email?: string; phone?: string } | null) => {
        setEmail(data?.email || "");
        setPhone(data?.phone || "");
      });
    };
    window.addEventListener("admin-open-account-details", openModal);
    return () => window.removeEventListener("admin-open-account-details", openModal);
  }, []);

  async function requestOtp() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, phone }) });
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setMessage(data.message || data.error || "Không thể gửi mã OTP");
    if (response.ok) setStep("otp");
    setLoading(false);
  }

  async function save() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, phone, otp }) });
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setMessage(data.message || data.error || "Không thể cập nhật thông tin");
    if (response.ok) {
      window.dispatchEvent(new Event("admin-account-updated"));
      window.setTimeout(() => setOpen(false), 700);
    }
    setLoading(false);
  }

  if (!open) return null;
  return (
    <div className="password-modal-backdrop" onClick={() => setOpen(false)}>
      <section className="admin-panel password-modal account-details-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Thông tin tài khoản">
        <button type="button" className="password-modal-close" onClick={() => setOpen(false)} aria-label="Đóng">×</button>
        <h2>Thông tin tài khoản</h2>
        <p>Chỉnh sửa email và số điện thoại. Khi lưu, mã OTP sẽ được gửi về email hiện tại của tài khoản.</p>
        <label className="admin-field"><span>Email tài khoản</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label className="admin-field"><span>Số điện thoại</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        {step === "otp" && <label className="admin-field"><span>Mã OTP 6 số</span><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" placeholder="Nhập mã trong email" /></label>}
        {step === "edit" ? <button className="save-button" type="button" onClick={() => void requestOtp()} disabled={loading}>{loading ? "Đang gửi OTP..." : "Gửi mã OTP"}</button> : <div className="account-details-actions"><button className="save-button" type="button" onClick={() => void save()} disabled={loading}>{loading ? "Đang lưu..." : "Xác nhận và lưu"}</button><button className="reset-button" type="button" onClick={() => void requestOtp()} disabled={loading}>Gửi lại mã</button></div>}
        {message && <p className="save-status" aria-live="polite">{message}</p>}
      </section>
    </div>
  );
}

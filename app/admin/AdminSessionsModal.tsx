"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  device: string;
  ip: string;
  location: string;
  active: boolean;
  current: boolean;
};

function formatDate(value: number) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function AdminSessionsModal() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/sessions", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { sessions?: Session[] };
      setSessions(data.sessions || []);
      setMessage("");
    } else if (response.status === 401) {
      window.location.href = "/admin/login?session=revoked";
    }
    setLoading(false);
  }

  useEffect(() => {
    const openModal = () => {
      setMessage("");
      setOpen(true);
      void load();
    };
    window.addEventListener("admin-open-sessions", openModal);
    return () => window.removeEventListener("admin-open-sessions", openModal);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [open]);

  async function signOut(session: Session) {
    if (session.current) return;
    if (!window.confirm(`Đăng xuất thiết bị “${session.device}” khỏi tài khoản?`)) return;
    const response = await fetch("/api/admin/sessions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    });
    if (response.ok) {
      setMessage("Đã đăng xuất thiết bị này");
      await load();
    } else {
      setMessage("Không thể đăng xuất thiết bị này");
    }
  }

  if (!open) return null;
  return (
    <div className="password-modal-backdrop session-modal-backdrop" onClick={() => setOpen(false)}>
      <section className="admin-panel password-modal session-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lịch sử đăng nhập">
        <button type="button" className="password-modal-close" onClick={() => setOpen(false)} aria-label="Đóng">×</button>
        <h2>Lịch sử đăng nhập</h2>
        <p>Các thiết bị đã đăng nhập vào tài khoản này.</p>
        {loading && <p className="save-status">Đang cập nhật…</p>}
        <div className="session-list">
          {sessions.length ? sessions.map((session) => (
            <article className={`session-item ${session.current ? "is-current" : ""} ${session.active ? "" : "is-ended"}`} key={session.id}>
              <div className="session-device"><span className="session-status-dot" /><strong>{session.device}</strong>{session.current && <em>Thiết bị này</em>}</div>
              <div className="session-details"><span>Đăng nhập: {formatDate(session.createdAt)}</span><span>Hoạt động: {formatDate(session.lastSeenAt)}</span><span>IP: {session.ip}</span><span>Vị trí: {session.location}</span></div>
              <div className="session-actions">{session.active ? <span className="session-state">Đang hoạt động</span> : <span className="session-state">Đã đăng xuất</span>}{!session.current && session.active && <button type="button" onClick={() => void signOut(session)}>Đăng xuất</button>}</div>
            </article>
          )) : <p className="save-status">Chưa có lịch sử đăng nhập.</p>}
        </div>
        {message && <p className="save-status" aria-live="polite">{message}</p>}
      </section>
    </div>
  );
}

"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const defaults = ["TE AMO MUCHO", "I LOVE YOU", "YÊU EM RẤT NHIỀU", "LOVE YOU"];

type Memory = { src: string; id: number };

function playChime() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  [261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.16);
    gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + index * 0.16 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.16 + 1.5);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(ctx.currentTime + index * 0.16);
    oscillator.stop(ctx.currentTime + index * 0.16 + 1.55);
  });
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export default function Home() {
  const [name, setName] = useState("Người mình thương");
  const [message, setMessage] = useState("TE AMO MUCHO");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [phase, setPhase] = useState<"intro" | "loading" | "show">("intro");
  const [muted, setMuted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const words = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        text: i % 5 === 0 ? "♥" : i % 4 === 0 ? defaults[(i / 4) % defaults.length] : message,
        left: (i * 37 + 7) % 92,
        top: (i * 53 + 3) % 96,
        size: 14 + ((i * 11) % 29),
        delay: -((i * 0.37) % 7),
        duration: 6 + ((i * 0.47) % 5),
        rotate: -18 + ((i * 13) % 37),
      })),
    [message],
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  function begin() {
    if (!muted) playChime();
    setPhase("loading");
    timer.current = setTimeout(() => setPhase("show"), 2100);
  }

  function pickPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    Promise.all(
      files.map(
        (file, id) =>
          new Promise<Memory>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ src: String(reader.result), id });
            reader.readAsDataURL(file);
          }),
      ),
    ).then(setMemories);
  }

  return (
    <main className={`experience phase-${phase}`}>
      {phase === "intro" && (
        <section className="intro">
          <div className="aurora" />
          <button
            className="sound"
            type="button"
            aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? "♩" : "♪"}
          </button>
          <div className="intro-card">
            <p className="eyebrow">A LITTLE SURPRISE FOR</p>
            <input
              aria-label="Tên người nhận"
              value={name}
              maxLength={28}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="tiny-heart">♥</div>
            <label className="field-label" htmlFor="message">
              Lời muốn nói
            </label>
            <input
              id="message"
              className="message-input"
              value={message}
              maxLength={32}
              onChange={(event) => setMessage(event.target.value.toUpperCase())}
            />
            <label className="upload">
              <span>{memories.length ? `Đã chọn ${memories.length} ảnh` : "Chọn ảnh kỷ niệm"}</span>
              <input type="file" accept="image/*" multiple onChange={pickPhotos} />
            </label>
            <button className="open-button" type="button" onClick={begin}>
              MỞ MÓN QUÀ
              <span>→</span>
            </button>
            <p className="hint">Chạm để bắt đầu điều bất ngờ</p>
          </div>
        </section>
      )}

      {phase === "loading" && (
        <section className="loading-screen" aria-live="polite">
          <div className="aurora" />
          <div className="loading-card">
            <div className="loading-heart">♥</div>
            <strong>Đang gom những điều dễ thương...</strong>
            <div className="progress"><span /></div>
            <small>Một chút nữa thôi</small>
          </div>
        </section>
      )}

      {phase === "show" && (
        <section className="love-world">
          <div className="vignette" />
          <div className="stars" />
          <div className="word-cloud" aria-hidden="true">
            {words.map((word) => (
              <span
                key={word.id}
                className={word.text === "♥" ? "floating-heart" : "floating-word"}
                style={{
                  left: `${word.left}%`,
                  top: `${word.top}%`,
                  fontSize: `${word.size}px`,
                  animationDelay: `${word.delay}s`,
                  animationDuration: `${word.duration}s`,
                  transform: `rotate(${word.rotate}deg)`,
                }}
              >
                {word.text}
              </span>
            ))}
          </div>
          {memories.map((memory, index) => (
            <figure
              className="memory"
              key={memory.id}
              style={{
                left: `${12 + ((index * 29) % 70)}%`,
                top: `${15 + ((index * 23) % 62)}%`,
                animationDelay: `${-index * 1.2}s`,
              }}
            >
              <img src={memory.src} alt={`Kỷ niệm ${index + 1}`} />
            </figure>
          ))}
          <div className="center-message">
            <span>DÀNH CHO</span>
            <h1>{name || "Người mình thương"}</h1>
            <p>{message || "TE AMO MUCHO"}</p>
            {!memories.length && <small>Thêm ảnh ở màn hình đầu để khoảnh khắc này là của riêng bạn</small>}
          </div>
          <button className="replay" type="button" onClick={() => setPhase("intro")}>
            ↻ Làm lại
          </button>
        </section>
      )}
    </main>
  );
}

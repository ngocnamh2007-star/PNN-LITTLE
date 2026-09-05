"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultConfig,
  GiftSelection,
  loadRemoteConfig,
  loadRemoteSelection,
  LoveConfig,
  saveRemoteSelection,
} from "./site-config";

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

  interface DeviceOrientationEvent {
    requestPermission?: () => Promise<"granted" | "denied">;
  }
}

export default function Home() {
  const [config, setConfig] = useState<LoveConfig>(defaultConfig);
  const [phase, setPhase] = useState<"intro" | "loading" | "show" | "finished" | "gift">("intro");
  const [selection, setSelection] = useState<GiftSelection | null>(null);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragPoint = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef({ x: -4, y: 0 });
  const orientationTarget = useRef({ x: -4, y: 0 });
  const orientationFrame = useRef<number | null>(null);
  const dragFrame = useRef<number | null>(null);
  const pendingDrag = useRef({ x: 0, y: 0 });

  function applyRotation(next: { x: number; y: number }) {
    rotationRef.current = next;
    if (sceneRef.current) {
      sceneRef.current.style.transform = `rotateX(${next.x}deg) rotateY(${next.y}deg)`;
    }
  }

  useEffect(() => {
    const update = () => void loadRemoteConfig().then(setConfig);
    const updateSelection = () => void loadRemoteSelection().then(setSelection);
    update();
    updateSelection();
    window.addEventListener("storage", update);
    window.addEventListener("storage", updateSelection);
    window.addEventListener("love-config-updated", update);
    window.addEventListener("love-selection-updated", updateSelection);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (endingTimer.current) clearTimeout(endingTimer.current);
      window.removeEventListener("storage", update);
      window.removeEventListener("storage", updateSelection);
      window.removeEventListener("love-config-updated", update);
      window.removeEventListener("love-selection-updated", updateSelection);
    };
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
    if (config.durationSeconds <= 0) return;
    endingTimer.current = setTimeout(
      () => setPhase(config.giftsEnabled ? "gift" : "finished"),
      Math.max(5, config.durationSeconds) * 1000,
    );
    return () => {
      if (endingTimer.current) clearTimeout(endingTimer.current);
    };
  }, [phase, config.durationSeconds, config.giftsEnabled]);

  useEffect(() => {
    if (!config.gyroscopeEnabled) setGyroEnabled(false);
  }, [config.gyroscopeEnabled]);

  useEffect(() => {
    if (phase !== "intro" && phase !== "finished" && phase !== "gift") return;
    if (!audio.current) return;
    audio.current.pause();
    audio.current.currentTime = 0;
  }, [phase]);

  useEffect(() => {
    if (!gyroEnabled || phase !== "show") return;
    const moveWithPhone = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      const portraitTilt = Math.max(-35, Math.min(35, event.beta - 45));
      const sideTilt = Math.max(-45, Math.min(45, event.gamma));
      orientationTarget.current = {
        x: Math.max(-18, Math.min(18, -portraitTilt * 0.32)),
        y: sideTilt * 0.42,
      };
      if (orientationFrame.current === null) {
        const smooth = () => {
          const current = rotationRef.current;
          const target = orientationTarget.current;
          const next = { x: current.x + (target.x - current.x) * 0.16, y: current.y + (target.y - current.y) * 0.16 };
          applyRotation(next);
          if (Math.abs(target.x - next.x) > 0.08 || Math.abs(target.y - next.y) > 0.08) {
            orientationFrame.current = requestAnimationFrame(smooth);
          } else {
            orientationFrame.current = null;
            applyRotation(target);
          }
        };
        orientationFrame.current = requestAnimationFrame(smooth);
      }
    };
    window.addEventListener("deviceorientation", moveWithPhone, true);
    return () => {
      window.removeEventListener("deviceorientation", moveWithPhone, true);
      if (orientationFrame.current !== null) cancelAnimationFrame(orientationFrame.current);
      orientationFrame.current = null;
    };
  }, [gyroEnabled, phase]);

  const words = useMemo(() => {
    const lines = config.floatingLines.length
      ? config.floatingLines
      : [config.mainMessage];
    return Array.from({ length: 96 }, (_, i) => ({
      id: i,
      text: i % 7 === 0 ? "♥" : lines[i % lines.length],
      left: -8 + ((i * 37 + 7) % 112),
      size: 11 + ((i * 17) % 48),
      delay: -((i * 0.79) % 15),
      duration: 8 + ((i * 0.43) % 9),
      rotate: -12 + ((i * 13) % 25),
      depth: -760 + ((i * 137) % 1240),
      drift: -90 + ((i * 83) % 180),
      tone: i % 6,
    }));
  }, [config]);

  const photoStream = useMemo(
    () =>
      config.photos.length
        ? Array.from({ length: Math.max(10, config.photos.length * 2) }, (_, index) => ({
            src: config.photos[index % config.photos.length],
            id: index,
            left: 4 + ((index * 31) % 84),
            delay: -((index * 2.17) % 18),
            duration: 13 + ((index * 1.3) % 7),
            depth: -520 + ((index * 229) % 940),
            tilt: -13 + ((index * 19) % 27),
          }))
        : [],
    [config.photos],
  );

  async function enableGyroscope() {
    if (
      !config.gyroscopeEnabled ||
      !window.matchMedia("(pointer: coarse)").matches ||
      !("DeviceOrientationEvent" in window)
    ) {
      return;
    }
    try {
      const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof orientationEvent.requestPermission === "function") {
        const permission = await orientationEvent.requestPermission();
        setGyroEnabled(permission === "granted");
      } else {
        setGyroEnabled(true);
      }
    } catch {
      setGyroEnabled(false);
    }
  }

  function begin() {
    void enableGyroscope();
    if (!muted) {
      if (config.music?.url && audio.current) {
        audio.current.currentTime = 0;
        void audio.current.play().catch(() => playChime());
      } else {
        playChime();
      }
    }
    setPhase("loading");
    timer.current = setTimeout(() => setPhase("show"), 2100);
  }

  function toggleSound() {
    setMuted((current) => {
      const next = !current;
      if (audio.current) {
        audio.current.muted = next;
        if (!next && config.music?.url) void audio.current.play().catch(() => undefined);
      }
      return next;
    });
  }

  function startDrag(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragPoint.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function moveScene(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    pendingDrag.current = { x: event.clientX, y: event.clientY };
    if (dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      const deltaX = pendingDrag.current.x - dragPoint.current.x;
      const deltaY = pendingDrag.current.y - dragPoint.current.y;
      dragPoint.current = pendingDrag.current;
      const current = rotationRef.current;
      applyRotation({
        x: Math.max(-24, Math.min(24, current.x - deltaY * 0.12)),
        y: current.y + deltaX * 0.16,
      });
    });
  }

  async function chooseGift(giftId: string) {
    const nextSelection = { giftId, selectedAt: new Date().toISOString() };
    setSelection(nextSelection);
    await saveRemoteSelection(nextSelection);
  }

  return (
    <main className={`experience phase-${phase}`}>
      {config.music?.url && (
        <audio
          ref={audio}
          src={config.music.url}
          loop
          preload="metadata"
          muted={muted}
          aria-hidden="true"
        />
      )}
      {phase === "intro" && (
        <section className="intro">
          <div className="aurora" />
          <button
            className="sound"
            type="button"
            aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
            onClick={toggleSound}
          >
            {muted ? "♩" : "♪"}
          </button>
          <div className="intro-card viewer-card">
            <p className="eyebrow">A LITTLE SURPRISE FOR</p>
            <h1>{config.recipient}</h1>
            <div className="tiny-heart">♥</div>
            <p className="gift-preview">{config.mainMessage}</p>
            <button className="open-button" type="button" onClick={begin}>
              MỞ MÓN QUÀ <span>→</span>
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

      {(phase === "show" || phase === "finished") && (
        <section
          className={`love-world ${phase === "finished" ? "is-finished" : ""} ${dragging ? "is-dragging" : ""}`}
          onPointerDown={startDrag}
          onPointerMove={moveScene}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <div className="vignette" />
          <div className="stars stars-far" />
          <div className="stars stars-near" />
          <div
            className="scene-3d"
            ref={sceneRef}
            style={{ transform: "rotateX(-4deg) rotateY(0deg)" }}
          >
            <div className="tunnel-glow" />
            <div className={`word-cloud font-${config.fontStyle}`} aria-hidden="true">
              {words.map((word) => (
                <span
                  key={word.id}
                  className={`${word.text === "♥" ? "floating-heart" : "floating-word"} tone-${word.tone}`}
                  style={{
                    left: `${word.left}%`,
                    fontSize: `${word.size}px`,
                    animationDelay: `${word.delay}s`,
                    animationDuration: `${word.duration}s`,
                    "--word-rotate": `${word.rotate}deg`,
                    "--word-depth": `${word.depth}px`,
                    "--word-drift": `${word.drift}px`,
                  } as React.CSSProperties}
                >
                  {word.text}
                </span>
              ))}
            </div>
            {photoStream.map((photo) => (
              <figure
                className="memory"
                key={`${photo.src.slice(-18)}-${photo.id}`}
                style={{
                  left: `${photo.left}%`,
                  animationDelay: `${photo.delay}s`,
                  animationDuration: `${photo.duration}s`,
                  "--photo-depth": `${photo.depth}px`,
                  "--photo-tilt": `${photo.tilt}deg`,
                } as React.CSSProperties}
              >
                <img src={photo.src} alt="" draggable={false} />
              </figure>
            ))}
          </div>
          <div className="drag-hint">
            {gyroEnabled
              ? "↔ Nghiêng điện thoại để khám phá không gian"
              : "↔ Kéo hoặc vuốt để khám phá không gian"}
          </div>
          <button className="replay" type="button" onClick={() => setPhase("intro")}>
            ← Thoát về trang mở quà
          </button>
          {phase === "finished" && (
            <div className="experience-finished" aria-live="polite">
              <span>♥</span>
              <strong>Điều bất ngờ đã kết thúc</strong>
            </div>
          )}
        </section>
      )}

      {phase === "gift" && (
        <section className="gift-stage">
          <div className="aurora" />
          <div className="gift-modal">
            {!selection ? (
              <>
                <p className="eyebrow">MỘT ĐIỀU CUỐI CÙNG</p>
                <h2>Chọn một món quà nhé</h2>
                <p className="gift-subtitle">Chỉ được chọn một lần, hãy chọn điều bạn thích nhất.</p>
                <div className="gift-options">
                  {config.gifts.map((gift) => (
                    <button type="button" className="gift-option" key={gift.id} onClick={() => chooseGift(gift.id)}>
                      <span>{gift.emoji}</span>
                      <strong>{gift.title}</strong>
                      <small>Chạm để mở món quà</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="chosen-gift">
                {(() => {
                  const gift = config.gifts.find((item) => item.id === selection.giftId);
                  return gift ? (
                    <>
                      <p className="eyebrow">BẠN ĐÃ CHỌN</p>
                      <span className="chosen-emoji">{gift.emoji}</span>
                      <h2>{gift.title}</h2>
                      <p>{gift.description}</p>
                      <small>Lựa chọn đã được gửi đến người tặng quà ♥</small>
                    </>
                  ) : (
                    <p>Món quà đã được ghi nhận.</p>
                  );
                })()}
              </div>
            )}
          </div>
          <button className="gift-exit" type="button" onClick={() => setPhase("intro")}>
            ← Thoát về trang mở quà
          </button>
        </section>
      )}
    </main>
  );
}

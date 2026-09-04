"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import {
  defaultConfig,
  clearRemoteSelection,
  GiftOption,
  GiftSelection,
  loadRemoteConfig,
  loadRemoteSelection,
  LoveConfig,
  saveConfig,
  saveRemoteConfig,
} from "../site-config";

function compressPhoto(source: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const temporaryUrl = typeof source === "string" ? source : URL.createObjectURL(source);
    image.onload = () => {
      const maxSide = 820;
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      let width = Math.max(1, Math.round(image.naturalWidth * ratio));
      let height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      const drawingContext = context;

      function render(quality: number) {
        canvas.width = width;
        canvas.height = height;
        drawingContext.fillStyle = "#ffffff";
        drawingContext.fillRect(0, 0, width, height);
        drawingContext.drawImage(image, 0, 0, width, height);
        return canvas.toDataURL("image/jpeg", quality);
      }

      let result = render(0.76);
      if (result.length > 240_000) result = render(0.56);
      if (result.length > 240_000) {
        width = Math.round(width * 0.72);
        height = Math.round(height * 0.72);
        result = render(0.52);
      }
      if (typeof source !== "string") URL.revokeObjectURL(temporaryUrl);
      resolve(result);
    };
    image.onerror = () => {
      if (typeof source !== "string") URL.revokeObjectURL(temporaryUrl);
      reject(new Error("Image decode failed"));
    };
    image.src = temporaryUrl;
  });
}

export default function AdminPage() {
  const [config, setConfig] = useState<LoveConfig>(defaultConfig);
  const [newLine, setNewLine] = useState("");
  const [selection, setSelection] = useState<GiftSelection | null>(null);
  const [status, setStatus] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [accountName, setAccountName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [musicProgress, setMusicProgress] = useState(0);
  const [selectedMusic, setSelectedMusic] = useState<File | null>(null);
  const [musicStatus, setMusicStatus] = useState("");

  useEffect(() => {
    const updateSelection = () => void loadRemoteSelection().then(setSelection);
    const updateSelectionWhenVisible = () => {
      if (document.visibilityState === "visible") updateSelection();
    };
    void loadRemoteConfig().then(setConfig);
    void fetch("/api/admin/me").then((response) => response.ok ? response.json() : null).then((data: { username?: string } | null) => setAccountName(data?.username || ""));
    updateSelection();
    window.addEventListener("storage", updateSelection);
    window.addEventListener("love-selection-updated", updateSelection);
    document.addEventListener("visibilitychange", updateSelectionWhenVisible);
    const selectionPolling = window.setInterval(updateSelectionWhenVisible, 15000);
    return () => {
      window.clearInterval(selectionPolling);
      window.removeEventListener("storage", updateSelection);
      window.removeEventListener("love-selection-updated", updateSelection);
      document.removeEventListener("visibilitychange", updateSelectionWhenVisible);
    };
  }, []);

  function update<K extends keyof LoveConfig>(key: K, value: LoveConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
    setStatus("");
  }

  function addLine() {
    const line = newLine.trim().toUpperCase();
    if (!line) return;
    update("floatingLines", [...config.floatingLines, line]);
    setNewLine("");
  }

  function changeFont(fontStyle: LoveConfig["fontStyle"]) {
    const nextConfig = { ...config, fontStyle };
    setConfig(nextConfig);
    void saveRemoteConfig(nextConfig)
      .then(() => setStatus("Đã áp dụng phông chữ mới"))
      .catch(() => setStatus("Chưa thể lưu trực tuyến"));
  }

  function removeLine(index: number) {
    update("floatingLines", config.floatingLines.filter((_, itemIndex) => itemIndex !== index));
  }

  function addGift() {
    const gift: GiftOption = {
      id: `gift-${Date.now()}`,
      emoji: "🎁",
      title: "Món quà mới",
      description: "Nhập mô tả cho món quà này.",
    };
    update("gifts", [...config.gifts, gift]);
  }

  function updateGift(index: number, patch: Partial<GiftOption>) {
    const gifts = [...config.gifts];
    gifts[index] = { ...gifts[index], ...patch };
    update("gifts", gifts);
  }

  async function clearSelection() {
    try {
      await clearRemoteSelection();
      setSelection(null);
      setStatus("Đã mở lại lượt chọn quà");
    } catch {
      setStatus("Chưa thể mở lại lượt chọn");
    }
  }

  async function pickPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const slots = Math.max(0, 8 - config.photos.length);
    if (!slots) {
      setStatus("Bạn đã thêm đủ 8 ảnh.");
      return;
    }
    setStatus("Đang tối ưu ảnh...");
    try {
      const photos = await Promise.all(files.slice(0, slots).map(compressPhoto));
      setConfig((current) => ({ ...current, photos: [...current.photos, ...photos] }));
      setStatus(`Đã tối ưu và thêm ${photos.length} ảnh. Hãy bấm “Lưu thay đổi”.`);
      event.target.value = "";
    } catch {
      setStatus("Có ảnh không đọc được. Bạn hãy thử chọn ảnh khác.");
    }
  }

  function pickMusic(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const audioExtensions = /\.(mp3|m4a|aac|wav|ogg|oga|webm|flac)$/i;
    if (!file.type.startsWith("audio/") && !audioExtensions.test(file.name)) {
      setMusicStatus("Tệp đã chọn không phải là âm thanh.");
      event.target.value = "";
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setMusicStatus("Tệp nhạc cần nhỏ hơn 25 MB.");
      event.target.value = "";
      return;
    }
    setSelectedMusic(file);
    setMusicStatus(`Đã chọn “${file.name}”. Bấm “Tải bài này lên” để hoàn tất.`);
  }

  async function uploadMusic() {
    const file = selectedMusic;
    if (!file || uploadingMusic) return;
    setUploadingMusic(true);
    setMusicProgress(0);
    setMusicStatus(`Đang tải “${file.name}” lên, bạn đợi một chút...`);
    try {
      const chunkSize = 700 * 1024;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = crypto.randomUUID();
      let uploadedMusic: LoveConfig["music"] = null;

      for (let part = 0; part < totalChunks; part++) {
        const params = new URLSearchParams({
          uploadId,
          part: String(part),
          total: String(totalChunks),
          name: file.name,
          type: file.type || "audio/mpeg",
          size: String(file.size),
        });
        const response = await fetch(`/api/music?${params}`, {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: file.slice(part * chunkSize, Math.min(file.size, (part + 1) * chunkSize)),
        });
        const responseText = await response.text();
        let payload: {
          music?: LoveConfig["music"];
          error?: string;
        } = {};
        try {
          payload = JSON.parse(responseText) as typeof payload;
        } catch {
          payload = {};
        }
        if (!response.ok) throw new Error(payload.error || `Lỗi ở phần ${part + 1}`);
        if (payload.music) uploadedMusic = payload.music;
        const progress = Math.round(((part + 1) / totalChunks) * 100);
        setMusicProgress(progress);
        setMusicStatus(`Đang tải “${file.name}”… ${progress}%`);
        if (part < totalChunks - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1100));
        }
      }

      if (!uploadedMusic) throw new Error("Máy chủ chưa hoàn tất bài nhạc");
      const nextConfig = { ...config, music: uploadedMusic };
      setConfig(nextConfig);
      setSelectedMusic(null);
      setMusicStatus(`✓ Đã tải và lưu bài “${file.name}” thành công.`);
    } catch (error) {
      setMusicStatus(
        error instanceof Error && error.message !== "Upload failed"
          ? `Không thể tải nhạc: ${error.message}`
          : "Không thể tải nhạc lên. Hãy kiểm tra tệp nhỏ hơn 25 MB rồi thử lại.",
      );
    } finally {
      setUploadingMusic(false);
    }
  }

  async function removeMusic() {
    setStatus("Đang xóa nhạc...");
    try {
      const response = await fetch("/api/music", { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      const nextConfig = { ...config, music: null };
      setConfig(nextConfig);
      setSelectedMusic(null);
      setMusicStatus("Đã xóa nhạc nền.");
      setStatus("Đã xóa nhạc nền");
    } catch {
      setStatus("Chưa thể xóa nhạc.");
    }
  }

  async function persist() {
    setStatus("Đang tối ưu và lưu ảnh...");
    try {
      const optimizedPhotos = await Promise.all(config.photos.map(compressPhoto));
      const optimizedConfig = { ...config, photos: optimizedPhotos };
      await saveRemoteConfig(optimizedConfig);
      setConfig(optimizedConfig);
      setShareLink(`${window.location.origin}/?account=${encodeURIComponent(accountName)}`);
      setStatus("Đã lưu nội dung thành công — link đã sẵn sàng để gửi");
    } catch {
      setStatus("Không thể lưu ảnh. Hãy xóa một ảnh rồi thử lại.");
    }
  }

  async function updatePassword() {
    if (newPassword !== confirmPassword) {
      setStatus("Mật khẩu xác nhận chưa khớp");
      return;
    }
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || "Không thể đổi mật khẩu");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setStatus("Đã đổi mật khẩu thành công");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  function resetAll() {
    setConfig(defaultConfig);
    saveConfig(defaultConfig);
    setStatus("Đã khôi phục nội dung ban đầu");
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">A LITTLE LOVE</p>
          <h1>Quản lý món quà</h1>
          <p>Chỉnh nội dung một lần, trang người xem sẽ sử dụng đúng nội dung bạn đã lưu.</p>
        </div>
        <Link href="/" className="preview-link">Xem trang món quà →</Link>
      </header>

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="panel-heading">
            <span>01</span>
            <div><h2>Nội dung chính</h2><p>Tên và lời nhắn xuất hiện ở trung tâm.</p></div>
          </div>
          <label className="admin-field">
            <span>Tên người nhận</span>
            <input
              value={config.recipient}
              maxLength={28}
              onChange={(event) => update("recipient", event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Thời lượng hiệu ứng trước khi chọn quà</span>
            <div className="duration-input">
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={config.durationSeconds}
                onChange={(event) => update("durationSeconds", Number(event.target.value))}
              />
              <strong>{config.durationSeconds} giây</strong>
            </div>
          </label>
          <div className="admin-toggle-list">
            <label className="admin-toggle">
              <div>
                <strong>Con quay hồi chuyển trên điện thoại</strong>
                <small>Nghiêng điện thoại để điều khiển không gian chữ và ảnh.</small>
              </div>
              <input
                type="checkbox"
                checked={config.gyroscopeEnabled}
                onChange={(event) => update("gyroscopeEnabled", event.target.checked)}
              />
              <span aria-hidden="true" />
            </label>
            <label className="admin-toggle">
              <div>
                <strong>Hiện phần chọn quà</strong>
                <small>Tắt để hiệu ứng kết thúc mà không hiện các món quà.</small>
              </div>
              <input
                type="checkbox"
                checked={config.giftsEnabled}
                onChange={(event) => update("giftsEnabled", event.target.checked)}
              />
              <span aria-hidden="true" />
            </label>
          </div>
          <label className="admin-field">
            <span>Lời muốn nói</span>
            <textarea
              value={config.mainMessage}
              maxLength={80}
              onChange={(event) => update("mainMessage", event.target.value.toUpperCase())}
            />
          </label>
          <label className="admin-field">
            <span>Phong cách chữ bay</span>
            <select
              value={config.fontStyle}
              onChange={(event) => changeFont(event.target.value as LoveConfig["fontStyle"])}
            >
              <option value="handwritten">Viết tay mềm mại</option>
              <option value="elegant">Thanh lịch có chân</option>
              <option value="rounded">Tròn dễ thương</option>
              <option value="modern">Hiện đại rõ nét</option>
              <option value="condensed">Cô đọng điện ảnh</option>
              <option value="dancing">Dancing — chữ ký bay bổng</option>
              <option value="pacifico">Pacifico — retro đáng yêu</option>
              <option value="playfair">Playfair — sang trọng</option>
              <option value="comfortaa">Comfortaa — tròn tối giản</option>
              <option value="bungee">Bungee — đậm cá tính</option>
              <option value="vietnam">Be Vietnam Pro — thuần Việt</option>
              <option value="space">Space Grotesk — công nghệ</option>
              <option value="cormorant">Cormorant — lãng mạn cổ điển</option>
              <option value="saira">Saira — mảnh và cô đọng</option>
            </select>
          </label>
          <div className={`font-preview font-${config.fontStyle}`}>
            {config.floatingLines[0] || config.mainMessage}
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading">
            <span>02</span>
            <div><h2>Câu chữ bay</h2><p>Thêm, sửa hoặc xóa từng câu xuất hiện trong hiệu ứng.</p></div>
          </div>
          <div className="line-list">
            {config.floatingLines.map((line, index) => (
              <div className="line-item" key={`${index}-${line}`}>
                <input
                  aria-label={`Câu chữ ${index + 1}`}
                  value={line}
                  onChange={(event) => {
                    const lines = [...config.floatingLines];
                    lines[index] = event.target.value.toUpperCase();
                    update("floatingLines", lines);
                  }}
                />
                <button type="button" onClick={() => removeLine(index)} aria-label={`Xóa câu ${line}`}>×</button>
              </div>
            ))}
          </div>
          <div className="add-line">
            <input
              value={newLine}
              placeholder="Nhập câu mới..."
              onChange={(event) => setNewLine(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addLine()}
            />
            <button type="button" onClick={addLine}>+ Thêm câu</button>
          </div>
        </section>

        <section className="admin-panel photos-panel">
          <div className="panel-heading">
            <span>03</span>
            <div><h2>Ảnh kỷ niệm</h2><p>Thêm tối đa 8 ảnh và xóa ảnh không còn sử dụng.</p></div>
          </div>
          <div className="photo-grid">
            {config.photos.map((src, index) => (
              <div className="photo-card" key={`${src.slice(-18)}-${index}`}>
                <img src={src} alt={`Ảnh kỷ niệm ${index + 1}`} />
                <button
                  type="button"
                  onClick={() => update("photos", config.photos.filter((_, photoIndex) => photoIndex !== index))}
                  aria-label={`Xóa ảnh ${index + 1}`}
                >
                  Xóa
                </button>
              </div>
            ))}
            {config.photos.length < 8 && (
              <label className="photo-upload">
                <strong>＋</strong>
                <span>Thêm ảnh</span>
                <input type="file" accept="image/*" multiple onChange={pickPhotos} />
              </label>
            )}
          </div>
        </section>

        <section className="admin-panel gifts-panel">
          <div className="panel-heading">
            <span>04</span>
            <div><h2>Các phần quà</h2><p>Nội dung bên dưới chỉ hiện sau khi người nhận chọn; những món còn lại sẽ được ẩn.</p></div>
          </div>
          <div className="gift-editor-list">
            {config.gifts.map((gift, index) => (
              <div className="gift-editor" key={gift.id}>
                <input
                  className="emoji-input"
                  aria-label={`Biểu tượng quà ${index + 1}`}
                  value={gift.emoji}
                  maxLength={4}
                  onChange={(event) => updateGift(index, { emoji: event.target.value })}
                />
                <div>
                  <input
                    aria-label={`Tên quà ${index + 1}`}
                    value={gift.title}
                    onChange={(event) => updateGift(index, { title: event.target.value })}
                  />
                  <textarea
                    aria-label={`Mô tả quà ${index + 1}`}
                    value={gift.description}
                    onChange={(event) => updateGift(index, { description: event.target.value })}
                  />
                </div>
                <button
                  type="button"
                  disabled={config.gifts.length <= 1}
                  onClick={() => update("gifts", config.gifts.filter((_, giftIndex) => giftIndex !== index))}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
          <button className="add-gift-button" type="button" onClick={addGift}>＋ Thêm phần quà</button>
        </section>

        <section className="admin-panel music-panel">
          <div className="panel-heading">
            <span>05</span>
            <div><h2>Nhạc nền</h2><p>Tải MP3, M4A, WAV, OGG hoặc tệp âm thanh khác, tối đa 25 MB.</p></div>
          </div>
          {config.music ? (
            <div className="music-current">
              <div className="music-icon">♫</div>
              <div className="music-info">
                <small>ĐANG SỬ DỤNG</small>
                <strong>{config.music.name}</strong>
                <audio src={config.music.url} controls preload="metadata" />
              </div>
              <button type="button" onClick={removeMusic}>Xóa nhạc</button>
            </div>
          ) : (
            <div className="music-empty">Chưa có nhạc nền. Người nhận sẽ nghe tiếng chuông mặc định.</div>
          )}
          <label className={`music-upload ${uploadingMusic ? "is-uploading" : ""}`}>
            <strong>{config.music ? "Chọn bài nhạc khác" : "＋ Chọn nhạc từ máy"}</strong>
            <span>MP3, M4A, WAV, OGG… tối đa 25 MB</span>
            <input
              type="file"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.webm,.flac"
              disabled={uploadingMusic}
              onChange={pickMusic}
            />
          </label>
          {selectedMusic && (
            <div className="music-selected">
              <div>
                <small>TỆP ĐÃ CHỌN</small>
                <strong>{selectedMusic.name}</strong>
                <span>{(selectedMusic.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <button type="button" disabled={uploadingMusic} onClick={uploadMusic}>
                {uploadingMusic ? `Đang tải ${musicProgress}%` : "Tải bài này lên"}
              </button>
            </div>
          )}
          {uploadingMusic && (
            <div className="music-progress" aria-hidden="true">
              <span style={{ width: `${musicProgress}%` }} />
            </div>
          )}
          {musicStatus && (
            <p className={`music-status ${uploadingMusic ? "is-loading" : ""}`} aria-live="polite">
              {uploadingMusic && <span className="music-spinner" aria-hidden="true" />}
              {musicStatus}
            </p>
          )}
          <p className="music-note">Nhạc sẽ bắt đầu sau khi người nhận bấm “Mở món quà”.</p>
        </section>

        <section className="admin-panel result-panel">
          <div className="panel-heading">
            <span>06</span>
            <div><h2>Kết quả lựa chọn</h2><p>Xem món quà mà người nhận đã chọn.</p></div>
          </div>
          {selection ? (
            <div className="selection-result">
              <span>{config.gifts.find((gift) => gift.id === selection.giftId)?.emoji || "🎁"}</span>
              <div>
                <small>ĐÃ CHỌN</small>
                <strong>{config.gifts.find((gift) => gift.id === selection.giftId)?.title || "Món quà đã xóa"}</strong>
                <p>{new Date(selection.selectedAt).toLocaleString("vi-VN")}</p>
              </div>
              <button type="button" onClick={clearSelection}>Cho chọn lại</button>
            </div>
          ) : (
            <div className="no-selection">Chưa có lựa chọn nào được gửi.</div>
          )}
        </section>

        <section className="admin-panel security-panel">
          <div className="panel-heading">
            <span>07</span>
            <div><h2>Bảo mật trang quản lý</h2><p>Đổi mật khẩu riêng hoặc đăng xuất khỏi thiết bị này.</p></div>
          </div>
          <div className="password-grid">
            <label className="admin-field">
              <span>Mật khẩu hiện tại</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Mật khẩu mới</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Nhập lại mật khẩu mới</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          </div>
          <div className="security-actions">
            <button type="button" onClick={updatePassword}>Đổi mật khẩu</button>
            <button type="button" className="logout-button" onClick={logout}>Đăng xuất</button>
          </div>
        </section>
      </div>

      <footer className="admin-actions">
        <button className="reset-button" type="button" onClick={resetAll}>Khôi phục ban đầu</button>
        <div>
          {status && <span className="save-status">{status}</span>}
          <button className="save-button" type="button" onClick={persist}>Lưu thay đổi</button>
        </div>
        {shareLink && (
          <div className="share-link">
            <input readOnly value={shareLink} aria-label="Link gửi người nhận" />
            <button type="button" onClick={() => void navigator.clipboard?.writeText(shareLink)}>Sao chép link</button>
          </div>
        )}
      </footer>
    </main>
  );
}

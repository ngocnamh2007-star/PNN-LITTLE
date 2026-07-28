export type LoveConfig = {
  recipient: string;
  mainMessage: string;
  durationSeconds: number;
  gyroscopeEnabled: boolean;
  giftsEnabled: boolean;
  fontStyle:
    | "modern"
    | "handwritten"
    | "elegant"
    | "rounded"
    | "condensed"
    | "dancing"
    | "pacifico"
    | "playfair"
    | "comfortaa"
    | "bungee"
    | "vietnam"
    | "space"
    | "cormorant"
    | "saira";
  floatingLines: string[];
  photos: string[];
  gifts: GiftOption[];
  music: MusicTrack | null;
};

export type MusicTrack = {
  name: string;
  url: string;
  type: string;
};

export type GiftOption = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};

export type GiftSelection = {
  giftId: string;
  selectedAt: string;
};

export const STORAGE_KEY = "a-little-love-config-v2";
export const SELECTION_KEY = "a-little-love-selection-v1";

export const defaultConfig: LoveConfig = {
  recipient: "Người mình thương",
  mainMessage: "YÊU EM RẤT NHIỀU",
  durationSeconds: 25,
  gyroscopeEnabled: true,
  giftsEnabled: true,
  fontStyle: "handwritten",
  floatingLines: [
    "YÊU EM RẤT NHIỀU",
    "MÃI BÊN NHAU NHÉ",
    "EM LÀ ĐIỀU TUYỆT VỜI NHẤT",
    "CẢM ƠN EM ĐÃ ĐẾN",
  ],
  photos: [],
  music: null,
  gifts: [
    { id: "gift-date", emoji: "🌹", title: "Một buổi hẹn", description: "Một ngày chỉ dành riêng cho hai chúng ta." },
    { id: "gift-surprise", emoji: "🎁", title: "Quà bí mật", description: "Một món quà bất ngờ do mình chuẩn bị." },
    { id: "gift-wish", emoji: "✨", title: "Một điều ước", description: "Bạn được yêu cầu mình thực hiện một điều." },
  ],
};

export function loadConfig(): LoveConfig {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    return {
      ...defaultConfig,
      ...saved,
      floatingLines: Array.isArray(saved.floatingLines)
        ? saved.floatingLines.filter(Boolean)
        : defaultConfig.floatingLines,
      photos: Array.isArray(saved.photos) ? saved.photos : [],
      gifts: Array.isArray(saved.gifts) ? saved.gifts : defaultConfig.gifts,
      music: saved.music?.url ? saved.music : null,
    };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: LoveConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("love-config-updated"));
}

export function loadSelection(): GiftSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const selection = JSON.parse(localStorage.getItem(SELECTION_KEY) || "null");
    return selection?.giftId ? selection : null;
  } catch {
    return null;
  }
}

export function saveSelection(selection: GiftSelection | null) {
  if (selection) localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
  else localStorage.removeItem(SELECTION_KEY);
  window.dispatchEvent(new Event("love-selection-updated"));
}

export async function loadRemoteConfig(): Promise<LoveConfig> {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return loadConfig();
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Config unavailable");
    const payload = (await response.json()) as { config: LoveConfig };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.config));
    return payload.config;
  } catch {
    return loadConfig();
  }
}

export async function saveRemoteConfig(config: LoveConfig) {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    saveConfig(config);
    return;
  }
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config }),
  });
  if (!response.ok) throw new Error("Unable to save online");
  saveConfig(config);
}

export async function loadRemoteSelection(): Promise<GiftSelection | null> {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return loadSelection();
  try {
    const response = await fetch("/api/selection", { cache: "no-store" });
    if (!response.ok) throw new Error("Selection unavailable");
    const payload = (await response.json()) as { selection: GiftSelection | null };
    if (payload.selection) {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(payload.selection));
    } else {
      localStorage.removeItem(SELECTION_KEY);
    }
    return payload.selection;
  } catch {
    return loadSelection();
  }
}

export async function saveRemoteSelection(selection: GiftSelection) {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    saveSelection(selection);
    return;
  }
  const response = await fetch("/api/selection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selection }),
  });
  if (!response.ok) throw new Error("Unable to save selection");
  saveSelection(selection);
}

export async function clearRemoteSelection() {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    saveSelection(null);
    return;
  }
  const response = await fetch("/api/selection", { method: "DELETE" });
  if (!response.ok) throw new Error("Unable to clear selection");
  saveSelection(null);
}

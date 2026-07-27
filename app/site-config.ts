export type LoveConfig = {
  recipient: string;
  mainMessage: string;
  durationSeconds: number;
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
  fontStyle: "handwritten",
  floatingLines: [
    "YÊU EM RẤT NHIỀU",
    "MÃI BÊN NHAU NHÉ",
    "EM LÀ ĐIỀU TUYỆT VỜI NHẤT",
    "CẢM ƠN EM ĐÃ ĐẾN",
  ],
  photos: [],
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

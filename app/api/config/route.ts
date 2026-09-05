import { adminUsernameFromRequest, isAdminAccountDisabled, isAdminRequest, scopedStateKey } from "../../admin-auth";
import { defaultConfig, LoveConfig } from "../../site-config";
import { readState, writeState } from "../state-store";

const CONFIG_KEY = "love-config";
const MUSIC_STATE_KEY = "love-music";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const account = url.searchParams.get("account") || await adminUsernameFromRequest(request);
  if (url.searchParams.get("account") && await isAdminAccountDisabled(account)) return Response.json({ error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên." }, { status: 423 });
  try {
    const [config, music] = await Promise.all([
      readState<LoveConfig>(scopedStateKey(CONFIG_KEY, account)),
      readState<LoveConfig["music"]>(scopedStateKey(MUSIC_STATE_KEY, account)),
    ]);
    return Response.json({
      config: {
        ...defaultConfig,
        ...(config ?? {}),
        music: music ?? config?.music ?? null,
      },
    });
  } catch {
    return Response.json({ config: defaultConfig });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { config?: LoveConfig };
  if (!payload.config?.recipient || !Array.isArray(payload.config.gifts)) {
    return Response.json({ error: "Invalid configuration" }, { status: 400 });
  }
  await writeState(scopedStateKey(CONFIG_KEY, await adminUsernameFromRequest(request)), payload.config);
  return Response.json({ config: payload.config });
}

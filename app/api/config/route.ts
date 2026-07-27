import { isAdminRequest } from "../../admin-auth";
import { defaultConfig, LoveConfig } from "../../site-config";
import { readState, writeState } from "../state-store";

const CONFIG_KEY = "love-config";
const MUSIC_STATE_KEY = "love-music";

export async function GET() {
  try {
    const [config, music] = await Promise.all([
      readState<LoveConfig>(CONFIG_KEY),
      readState<LoveConfig["music"]>(MUSIC_STATE_KEY),
    ]);
    return Response.json({
      config: {
        ...(config ?? defaultConfig),
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
  await writeState(CONFIG_KEY, payload.config);
  return Response.json({ config: payload.config });
}

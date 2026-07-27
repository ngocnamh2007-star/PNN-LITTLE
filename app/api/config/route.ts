import { getChatGPTUser } from "../../chatgpt-auth";
import { defaultConfig, LoveConfig } from "../../site-config";
import { readState, writeState } from "../state-store";

const CONFIG_KEY = "love-config";

export async function GET() {
  try {
    const config = await readState<LoveConfig>(CONFIG_KEY);
    return Response.json({ config: config ?? defaultConfig });
  } catch {
    return Response.json({ config: defaultConfig });
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as { config?: LoveConfig };
  if (!payload.config?.recipient || !Array.isArray(payload.config.gifts)) {
    return Response.json({ error: "Invalid configuration" }, { status: 400 });
  }
  await writeState(CONFIG_KEY, payload.config);
  return Response.json({ config: payload.config });
}

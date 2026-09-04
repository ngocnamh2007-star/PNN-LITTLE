import { adminUsernameFromRequest, isAdminRequest, scopedStateKey } from "../../admin-auth";
import { GiftSelection } from "../../site-config";
import { deleteState, readState, writeState } from "../state-store";

const SELECTION_KEY = "gift-selection";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json({ selection: await readState<GiftSelection>(scopedStateKey(SELECTION_KEY, url.searchParams.get("account") || await adminUsernameFromRequest(request))) });
  } catch {
    return Response.json({ selection: null });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { selection?: GiftSelection };
  if (!payload.selection?.giftId) {
    return Response.json({ error: "Invalid selection" }, { status: 400 });
  }
  await writeState(scopedStateKey(SELECTION_KEY, new URL(request.url).searchParams.get("account") || "legacy"), payload.selection);
  return Response.json({ selection: payload.selection }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteState(scopedStateKey(SELECTION_KEY, await adminUsernameFromRequest(request)));
  return Response.json({ selection: null });
}

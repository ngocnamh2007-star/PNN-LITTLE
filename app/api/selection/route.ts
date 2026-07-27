import { isAdminRequest } from "../../admin-auth";
import { GiftSelection } from "../../site-config";
import { deleteState, readState, writeState } from "../state-store";

const SELECTION_KEY = "gift-selection";

export async function GET() {
  try {
    return Response.json({ selection: await readState<GiftSelection>(SELECTION_KEY) });
  } catch {
    return Response.json({ selection: null });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { selection?: GiftSelection };
  if (!payload.selection?.giftId) {
    return Response.json({ error: "Invalid selection" }, { status: 400 });
  }
  await writeState(SELECTION_KEY, payload.selection);
  return Response.json({ selection: payload.selection }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteState(SELECTION_KEY);
  return Response.json({ selection: null });
}

import { adminUsernameFromRequest } from "../../../admin-auth";

export async function GET(request: Request) {
  const username = await adminUsernameFromRequest(request);
  if (!username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ username });
}

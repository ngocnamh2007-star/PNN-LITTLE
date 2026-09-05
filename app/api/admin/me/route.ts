import { adminUsernameFromRequest, isAdminRequest } from "../../../admin-auth";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const username = await adminUsernameFromRequest(request);
  if (!username) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ username });
}

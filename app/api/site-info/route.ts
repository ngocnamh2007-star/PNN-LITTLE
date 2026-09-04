import { isOwnerRequest } from "../../admin-auth";
import { readState, writeState } from "../state-store";
const KEY = "site-info";
const defaults = { intro: "Tạo món quà trực tuyến dành riêng cho người bạn thương.", contact: "pnn.little@example.com", address: "Việt Nam", phone: "", facebook: "", twitter: "", links: "Giới thiệu\nHỗ trợ\nLiên hệ" };
export async function GET() { return Response.json({ info: { ...defaults, ...(await readState<typeof defaults>(KEY) || {}) } }); }
export async function PUT(request: Request) { if (!(await isOwnerRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 }); const info = (await request.json()) as typeof defaults; if (!info.intro?.trim() || !info.contact?.trim()) return Response.json({ error: "Vui lòng nhập đủ nội dung" }, { status: 400 }); await writeState(KEY, { intro: info.intro.trim(), contact: info.contact.trim() }); return Response.json({ info }); }

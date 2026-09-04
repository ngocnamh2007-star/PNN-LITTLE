import { OWNER_COOKIE } from "../../../admin-auth";
export async function POST() { return new Response(JSON.stringify({ ok: true }), { headers: { "set-cookie": `${OWNER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } }); }

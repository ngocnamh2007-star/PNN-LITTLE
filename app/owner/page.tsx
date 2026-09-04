import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnerRequest } from "../admin-auth";
import OwnerClient from "./OwnerClient";
export const dynamic = "force-dynamic";
export default async function OwnerPage() { const requestHeaders = await headers(); const host = requestHeaders.get("host") || ""; if (!host.startsWith("localhost") && !(await isOwnerRequest(new Request(`https://${host}`, { headers: requestHeaders })))) redirect("/owner/login"); return <OwnerClient />; }

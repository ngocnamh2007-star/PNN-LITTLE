import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnerRequest } from "../admin-auth";
import OwnerClient from "./OwnerClient";
import OwnerPasswordButton from "./OwnerPasswordButton";
import OwnerAccountSearch from "./OwnerAccountSearch";
export const dynamic = "force-dynamic";
export default async function OwnerPage() { const requestHeaders = await headers(); const host = requestHeaders.get("host") || ""; if (!host.startsWith("localhost") && !(await isOwnerRequest(new Request(`https://${host}`, { headers: requestHeaders })))) redirect("/owner/login"); return <><div className="owner-account-search-wrap"><OwnerAccountSearch /></div><OwnerClient /><div className="owner-password-floating"><OwnerPasswordButton /></div></>; }

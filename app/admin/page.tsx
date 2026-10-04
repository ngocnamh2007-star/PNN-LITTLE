import { headers } from "next/headers";
import { requireAdmin } from "../admin-auth";
import AdminPage from "./AdminClient";
import AdminPasswordModal from "./AdminPasswordModal";
import AdminSessionsModal from "./AdminSessionsModal";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (!isLocal) await requireAdmin();
  return <><AdminPage /><AdminPasswordModal /><AdminSessionsModal /></>;
}

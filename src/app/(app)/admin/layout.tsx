import { requireRole } from "@/lib/auth/requireRole";

// Guards every /admin/* route. The proxy already redirects non-admins at the
// edge; this repeats the check at the resource so the segment stays protected
// even if the proxy matcher changes.
//
// Chrome comes from the parent (app) group layout, so this renders children
// directly — it is a guard, not a layout.
export default async function AdminSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return <>{children}</>;
}

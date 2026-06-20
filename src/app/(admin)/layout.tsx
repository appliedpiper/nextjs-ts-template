import AdminLayout from "@/components/layout/AdminLayout";

export default function AdminSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
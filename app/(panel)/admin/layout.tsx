import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/guards";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  await requireSuperAdmin();

  return children;
}
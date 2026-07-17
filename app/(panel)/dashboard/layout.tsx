import type { ReactNode } from "react";
import { requireClientAdmin } from "@/lib/auth/guards";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  await requireClientAdmin();

  return children;
}
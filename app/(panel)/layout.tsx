import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { PanelShell } from "@/components/layout/panel-shell";

type PanelLayoutProps = {
  children: React.ReactNode;
};

export default async function PanelLayout({
  children,
}: PanelLayoutProps) {
  const user = await requireAuthenticatedUser();

  return (
    <PanelShell user={user}>
      {children}
    </PanelShell>
  );
}
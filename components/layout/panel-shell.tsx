import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Tags,
  TriangleAlert,
} from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

type PanelUser = {
  name?: string | null;
  email?: string | null;
  role: "SUPER_ADMIN" | "CLIENT_ADMIN";
};

type PanelShellProps = {
  user: PanelUser;
  children: React.ReactNode;
};

const clientLinks = [
  {
    href: "/dashboard",
    label: "Visão geral",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/menus",
    label: "Cardápios",
    icon: BookOpen,
  },
  {
    href: "/dashboard/products",
    label: "Produtos",
    icon: Package,
  },
  {
    href: "/dashboard/categories",
    label: "Categorias",
    icon: Tags,
  },
];

const adminLinks = [
  {
    href: "/admin",
    label: "Visão geral",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/clients",
    label: "Clientes",
    icon: Building2,
  },
  {
    href: "/admin/plans",
    label: "Planos",
    icon: CreditCard,
  },
  {
    href: "/admin/audit",
    label: "Auditoria",
    icon: ScrollText,
  },
  {
    href: "/admin/errors",
    label: "Erros",
    icon: TriangleAlert,
  },
];

export function PanelShell({
  user,
  children,
}: PanelShellProps) {
  const links =
    user.role === "SUPER_ADMIN"
      ? adminLinks
      : clientLinks;

  return (
    <div className="min-h-svh bg-background md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r bg-sidebar md:flex md:flex-col">
        <div className="flex h-20 items-center border-b px-6">
          <div className="relative h-12 w-40">
            <Image
              src="/brand/menufy-logo.png"
              alt="MenuFy"
              fill
              priority
              unoptimized
              sizes="160px"
              className="object-contain"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">
            {user.name ?? "Usuário MenuFy"}
          </p>

          <p className="truncate text-xs text-muted-foreground">
            {user.email}
          </p>

          <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {user.role === "SUPER_ADMIN"
              ? "Super Admin"
              : "Cliente"}
          </span>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="relative h-10 w-32 md:hidden">
              <Image
                src="/brand/menufy-logo.png"
                alt="MenuFy"
                fill
                priority
                unoptimized
                sizes="128px"
                className="object-contain"
              />
            </div>

            <div className="hidden md:block">
              <p className="text-sm text-muted-foreground">
                Bem-vindo,
              </p>

              <p className="font-semibold">
                {user.name ?? "Usuário MenuFy"}
              </p>
            </div>

            <form
              action={async () => {
                "use server";

                await signOut({
                  redirectTo: "/login",
                });
              }}
            >
              <Button
                type="submit"
                variant="outline"
                size="sm"
              >
                <LogOut />
                Sair
              </Button>
            </form>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t px-4 py-3 md:hidden">
            {links.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium"
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
import Link from "next/link";
import {
  BookOpen,
  Package,
  Plus,
  Tags,
} from "lucide-react";
import { requireClientAdmin } from "@/lib/auth/guards";
import { getClientDashboardSummary } from "@/lib/data/dashboard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireClientAdmin();
  const summary =
    await getClientDashboardSummary(user);

  const maxMenus = summary.client.plan.maxMenus;

  const menuUsagePercentage =
    maxMenus > 0
      ? Math.min(
          (summary.menusCount / maxMenus) * 100,
          100,
        )
      : 100;

  const cards = [
    {
      title: "Cardápios",
      value: summary.menusCount,
      description: `Limite de ${maxMenus}`,
      icon: BookOpen,
    },
    {
      title: "Produtos",
      value: summary.productsCount,
      description: "Produtos ativos",
      icon: Package,
    },
    {
      title: "Categorias",
      value: summary.categoriesCount,
      description: "Categorias ativas",
      icon: Tags,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-primary">
            {summary.client.name}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Olá, {user.name ?? "cliente"}!
          </h1>

          <p className="mt-2 text-muted-foreground">
            Gerencie seus cardápios, produtos e
            categorias.
          </p>
        </div>

        <Button asChild>
          <Link href="/dashboard/menus/new">
            <Plus />
            Criar cardápio
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>

                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-3xl font-bold">
                  {card.value}
                </p>

                <CardDescription className="mt-1">
                  {card.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            Plano {summary.client.plan.name}
          </CardTitle>

          <CardDescription>
            Uso atual do limite de cardápios
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-2 flex justify-between text-sm">
            <span>
              {summary.menusCount} utilizados
            </span>

            <span>{maxMenus} disponíveis</span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${menuUsagePercentage}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import {
  BookOpen,
  Building2,
  ScrollText,
  TriangleAlert,
  Users,
} from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getAdminDashboardSummary } from "@/lib/data/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminPage() {
  const user = await requireSuperAdmin();
  const summary =
    await getAdminDashboardSummary(user);

  const cards = [
    {
      title: "Clientes",
      value: summary.clientsCount,
      description: `${summary.activeClientsCount} ativos`,
      icon: Building2,
    },
    {
      title: "Usuários ativos",
      value: summary.usersCount,
      description: "Contas com acesso",
      icon: Users,
    },
    {
      title: "Cardápios",
      value: summary.menusCount,
      description: "Não arquivados",
      icon: BookOpen,
    },
    {
      title: "Erros pendentes",
      value: summary.unresolvedErrorsCount,
      description: "Aguardando análise",
      icon: TriangleAlert,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">
          Painel administrativo
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Visão geral da MenuFy
        </h1>

        <p className="mt-2 text-muted-foreground">
          Acompanhe clientes, usuários e a saúde
          da plataforma.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ScrollText className="size-5" />
            </div>

            <div>
              <CardTitle>
                Atividade da plataforma
              </CardTitle>

              <CardDescription>
                Eventos registrados nas últimas
                24 horas
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-3xl font-bold">
            {summary.recentAuditCount}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            registros de auditoria
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
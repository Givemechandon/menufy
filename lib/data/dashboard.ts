import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  getClientIdFromUser,
  type TenantUser,
} from "@/lib/auth/tenant";

export async function getClientDashboardSummary(
  user: TenantUser,
) {
  const clientId = getClientIdFromUser(user);

  const [
    client,
    menusCount,
    categoriesCount,
    productsCount,
  ] = await Promise.all([
    prisma.client.findUnique({
      where: {
        id: clientId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        plan: {
          select: {
            name: true,
            maxMenus: true,
          },
        },
      },
    }),

    prisma.menu.count({
      where: {
        clientId,
        status: {
          not: "ARCHIVED",
        },
      },
    }),

    prisma.category.count({
      where: {
        clientId,
        isActive: true,
      },
    }),

    prisma.product.count({
      where: {
        clientId,
        isActive: true,
      },
    }),
  ]);

  if (!client || !client.isActive) {
    throw new ForbiddenError();
  }

  return {
    client,
    menusCount,
    categoriesCount,
    productsCount,
  };
}

export async function getAdminDashboardSummary(
  user: TenantUser,
) {
  if (user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError();
  }

  const [
    clientsCount,
    activeClientsCount,
    usersCount,
    menusCount,
    unresolvedErrorsCount,
    recentAuditCount,
  ] = await Promise.all([
    prisma.client.count(),

    prisma.client.count({
      where: {
        isActive: true,
      },
    }),

    prisma.user.count({
      where: {
        isActive: true,
      },
    }),

    prisma.menu.count({
      where: {
        status: {
          not: "ARCHIVED",
        },
      },
    }),

    prisma.errorLog.count({
      where: {
        resolvedAt: null,
      },
    }),

    prisma.auditLog.count({
      where: {
        createdAt: {
          gte: new Date(
            Date.now() - 24 * 60 * 60 * 1000,
          ),
        },
      },
    }),
  ]);

  return {
    clientsCount,
    activeClientsCount,
    usersCount,
    menusCount,
    unresolvedErrorsCount,
    recentAuditCount,
  };
}
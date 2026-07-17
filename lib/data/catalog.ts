import { prisma } from "@/lib/prisma";
import {
  getTenantFilter,
  type TenantUser,
} from "@/lib/auth/tenant";

export async function getMenusForUser(
  user: TenantUser,
) {
  return prisma.menu.findMany({
    where: {
      ...getTenantFilter(user),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getMenuForUserById(
  user: TenantUser,
  menuId: string,
) {
  return prisma.menu.findFirst({
    where: {
      id: menuId,
      ...getTenantFilter(user),
    },
    include: {
      menuCategories: {
        include: {
          category: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      menuProducts: {
        include: {
          product: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });
}

export async function getCategoriesForUser(
  user: TenantUser,
) {
  return prisma.category.findMany({
    where: {
      ...getTenantFilter(user),
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function getCategoryForUserById(
  user: TenantUser,
  categoryId: string,
) {
  return prisma.category.findFirst({
    where: {
      id: categoryId,
      ...getTenantFilter(user),
    },
  });
}

export async function getProductsForUser(
  user: TenantUser,
) {
  return prisma.product.findMany({
    where: {
      ...getTenantFilter(user),
    },
    include: {
      category: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getProductForUserById(
  user: TenantUser,
  productId: string,
) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      ...getTenantFilter(user),
    },
    include: {
      category: true,
    },
  });
}
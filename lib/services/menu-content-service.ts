import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  getTenantFilter,
  type TenantUser,
} from "@/lib/auth/tenant";
import { MenuNotFoundError } from "@/lib/services/menu-service";

const categoryItemSchema = z
  .object({
    categoryId: z.string().min(1),
    sortOrder: z
      .number()
      .int()
      .min(0)
      .max(10000),
    isVisible: z.boolean().default(true),
  })
  .strict();

const productItemSchema = z
  .object({
    productId: z.string().min(1),
    sortOrder: z
      .number()
      .int()
      .min(0)
      .max(10000),
    isVisible: z.boolean().default(true),
    customPriceCents: z
      .number()
      .int()
      .min(0)
      .max(99999999)
      .nullable()
      .optional(),
  })
  .strict();

const syncMenuContentSchema = z
  .object({
    categories: z
      .array(categoryItemSchema)
      .max(100),
    products: z
      .array(productItemSchema)
      .max(1000),
  })
  .strict();

export class InvalidMenuContentError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "InvalidMenuContentError";
  }
}

export class ArchivedMenuError extends Error {
  readonly statusCode = 409;

  constructor() {
    super(
      "O conteúdo de um cardápio arquivado não pode ser alterado.",
    );
    this.name = "ArchivedMenuError";
  }
}

function assertNoDuplicateIds(
  values: string[],
  resourceName: string,
) {
  if (new Set(values).size !== values.length) {
    throw new InvalidMenuContentError(
      `${resourceName} duplicados foram enviados.`,
    );
  }
}

export async function syncMenuContentForUser(
  user: TenantUser,
  menuId: string,
  rawInput: unknown,
) {
  const input =
    syncMenuContentSchema.parse(rawInput);

  const categoryIds = input.categories.map(
    (item) => item.categoryId,
  );

  const productIds = input.products.map(
    (item) => item.productId,
  );

  assertNoDuplicateIds(
    categoryIds,
    "IDs de categoria",
  );

  assertNoDuplicateIds(
    productIds,
    "IDs de produto",
  );

  const menu = await prisma.$transaction(
    async (transaction) => {
      const existingMenu =
        await transaction.menu.findFirst({
          where: {
            id: menuId,
            ...getTenantFilter(user),
          },
        });

      if (!existingMenu) {
        throw new MenuNotFoundError();
      }

      if (existingMenu.status === "ARCHIVED") {
        throw new ArchivedMenuError();
      }

      const categories =
        categoryIds.length > 0
          ? await transaction.category.findMany({
              where: {
                id: {
                  in: categoryIds,
                },
                clientId:
                  existingMenu.clientId,
                isActive: true,
              },
              select: {
                id: true,
              },
            })
          : [];

      if (
        categories.length !== categoryIds.length
      ) {
        throw new InvalidMenuContentError(
          "Uma ou mais categorias são inválidas, inativas ou pertencem a outro cliente.",
        );
      }

      const products =
        productIds.length > 0
          ? await transaction.product.findMany({
              where: {
                id: {
                  in: productIds,
                },
                clientId:
                  existingMenu.clientId,
                isActive: true,
                category: {
                  is: {
                    isActive: true,
                  },
                },
              },
              select: {
                id: true,
                categoryId: true,
              },
            })
          : [];

      if (products.length !== productIds.length) {
        throw new InvalidMenuContentError(
          "Um ou mais produtos são inválidos, inativos ou pertencem a outro cliente.",
        );
      }

      const selectedCategoryIds = new Set(
        categoryIds,
      );

      const productWithoutCategory =
        products.find(
          (product) =>
            !selectedCategoryIds.has(
              product.categoryId,
            ),
        );

      if (productWithoutCategory) {
        throw new InvalidMenuContentError(
          "Todo produto selecionado precisa ter sua categoria adicionada ao cardápio.",
        );
      }

      if (categoryIds.length === 0) {
        await transaction.menuCategory.deleteMany({
          where: {
            menuId: existingMenu.id,
          },
        });
      } else {
        await transaction.menuCategory.deleteMany({
          where: {
            menuId: existingMenu.id,
            categoryId: {
              notIn: categoryIds,
            },
          },
        });
      }

      if (productIds.length === 0) {
        await transaction.menuProduct.deleteMany({
          where: {
            menuId: existingMenu.id,
          },
        });
      } else {
        await transaction.menuProduct.deleteMany({
          where: {
            menuId: existingMenu.id,
            productId: {
              notIn: productIds,
            },
          },
        });
      }

      for (const item of input.categories) {
        await transaction.menuCategory.upsert({
          where: {
            menuId_categoryId: {
              menuId: existingMenu.id,
              categoryId: item.categoryId,
            },
          },
          create: {
            menuId: existingMenu.id,
            categoryId: item.categoryId,
            sortOrder: item.sortOrder,
            isVisible: item.isVisible,
          },
          update: {
            sortOrder: item.sortOrder,
            isVisible: item.isVisible,
          },
        });
      }

      for (const item of input.products) {
        await transaction.menuProduct.upsert({
          where: {
            menuId_productId: {
              menuId: existingMenu.id,
              productId: item.productId,
            },
          },
          create: {
            menuId: existingMenu.id,
            productId: item.productId,
            sortOrder: item.sortOrder,
            isVisible: item.isVisible,
            customPriceCents:
              item.customPriceCents ?? null,
          },
          update: {
            sortOrder: item.sortOrder,
            isVisible: item.isVisible,
            customPriceCents:
              item.customPriceCents ?? null,
          },
        });
      }

      return transaction.menu.findUniqueOrThrow({
        where: {
          id: existingMenu.id,
        },
        include: {
          menuCategories: {
            orderBy: {
              sortOrder: "asc",
            },
          },
          menuProducts: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });
    },
  );

  await createAuditLog({
    action: "MENU_CONTENT_UPDATED",
    entityType: "Menu",
    entityId: menu.id,
    actorId: user.id,
    clientId: menu.clientId,
    description:
      "Conteúdo do cardápio atualizado.",
    metadata: {
      categoriesCount:
        menu.menuCategories.length,
      productsCount:
        menu.menuProducts.length,
    },
  });

  return menu;
}
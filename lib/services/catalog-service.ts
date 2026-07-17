import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  getTenantFilter,
  resolveClientId,
  type TenantUser,
} from "@/lib/auth/tenant";

const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().min(2).max(80),
    description: z
      .string()
      .trim()
      .max(500)
      .optional(),
    sortOrder: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .default(0),
    clientId: z.string().min(1).optional(),
  })
  .strict();

const categoryUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .optional(),
    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),
    sortOrder: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.values(data).some(
        (value) => value !== undefined,
      ),
    {
      message: "Nenhuma alteração foi informada.",
    },
  );

const productCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z
      .string()
      .trim()
      .max(1000)
      .optional(),
    priceCents: z
      .number()
      .int()
      .min(0)
      .max(99999999),
    imageUrl: z
      .string()
      .trim()
      .url()
      .optional(),
    isAvailable: z.boolean().default(true),
    categoryId: z.string().min(1),
    clientId: z.string().min(1).optional(),
  })
  .strict();

const productUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional(),
    priceCents: z
      .number()
      .int()
      .min(0)
      .max(99999999)
      .optional(),
    imageUrl: z
      .union([
        z.string().trim().url(),
        z.null(),
      ])
      .optional(),
    isAvailable: z.boolean().optional(),
    categoryId: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.values(data).some(
        (value) => value !== undefined,
      ),
    {
      message: "Nenhuma alteração foi informada.",
    },
  );

export class CategoryNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Categoria não encontrada.");
    this.name = "CategoryNotFoundError";
  }
}

export class CategorySlugAlreadyExistsError extends Error {
  readonly statusCode = 409;

  constructor() {
    super(
      "Já existe uma categoria com este endereço.",
    );
    this.name = "CategorySlugAlreadyExistsError";
  }
}

export class ProductNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Produto não encontrado.");
    this.name = "ProductNotFoundError";
  }
}

export class InvalidProductCategoryError extends Error {
  readonly statusCode = 400;

  constructor() {
    super(
      "A categoria selecionada não pertence a este cliente ou está inativa.",
    );
    this.name = "InvalidProductCategoryError";
  }
}

export class CatalogClientInactiveError extends Error {
  readonly statusCode = 403;

  constructor() {
    super("Este cliente está inativo.");
    this.name = "CatalogClientInactiveError";
  }
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

export async function createCategoryForUser(
  user: TenantUser,
  rawInput: unknown,
) {
  const input =
    categoryCreateSchema.parse(rawInput);

  const clientId = resolveClientId(
    user,
    input.clientId,
  );

  const slug = normalizeSlug(input.slug);

  if (slug.length < 2) {
    throw new Error("Slug de categoria inválido.");
  }

  try {
    const category = await prisma.$transaction(
      async (transaction) => {
        const client =
          await transaction.client.findUnique({
            where: {
              id: clientId,
            },
          });

        if (!client || !client.isActive) {
          throw new CatalogClientInactiveError();
        }

        const existingCategory =
          await transaction.category.findFirst({
            where: {
              clientId,
              slug,
            },
            select: {
              id: true,
            },
          });

        if (existingCategory) {
          throw new CategorySlugAlreadyExistsError();
        }

        return transaction.category.create({
          data: {
            name: input.name,
            slug,
            description:
              input.description || null,
            sortOrder: input.sortOrder,
            clientId,
          },
        });
      },
    );

    await createAuditLog({
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: category.id,
      actorId: user.id,
      clientId: category.clientId,
      description: "Categoria criada.",
      metadata: {
        name: category.name,
      },
    });

    return category;
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      throw new CategorySlugAlreadyExistsError();
    }

    throw error;
  }
}

export async function updateCategoryForUser(
  user: TenantUser,
  categoryId: string,
  rawInput: unknown,
) {
  const input =
    categoryUpdateSchema.parse(rawInput);

  const slug = input.slug
    ? normalizeSlug(input.slug)
    : undefined;

  if (slug !== undefined && slug.length < 2) {
    throw new Error("Slug de categoria inválido.");
  }

  try {
    const category = await prisma.$transaction(
      async (transaction) => {
        const existingCategory =
          await transaction.category.findFirst({
            where: {
              id: categoryId,
              ...getTenantFilter(user),
            },
          });

        if (!existingCategory) {
          throw new CategoryNotFoundError();
        }

        if (slug) {
          const slugInUse =
            await transaction.category.findFirst({
              where: {
                clientId:
                  existingCategory.clientId,
                slug,
                id: {
                  not: existingCategory.id,
                },
              },
              select: {
                id: true,
              },
            });

          if (slugInUse) {
            throw new CategorySlugAlreadyExistsError();
          }
        }

        return transaction.category.update({
          where: {
            id: existingCategory.id,
          },
          data: {
            ...(input.name !== undefined && {
              name: input.name,
            }),
            ...(slug !== undefined && {
              slug,
            }),
            ...(input.description !== undefined && {
              description:
                input.description || null,
            }),
            ...(input.sortOrder !== undefined && {
              sortOrder: input.sortOrder,
            }),
          },
        });
      },
    );

    await createAuditLog({
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: category.id,
      actorId: user.id,
      clientId: category.clientId,
      description: "Categoria atualizada.",
    });

    return category;
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      throw new CategorySlugAlreadyExistsError();
    }

    throw error;
  }
}

export async function createProductForUser(
  user: TenantUser,
  rawInput: unknown,
) {
  const input =
    productCreateSchema.parse(rawInput);

  const clientId = resolveClientId(
    user,
    input.clientId,
  );

  const product = await prisma.$transaction(
    async (transaction) => {
      const client =
        await transaction.client.findUnique({
          where: {
            id: clientId,
          },
        });

      if (!client || !client.isActive) {
        throw new CatalogClientInactiveError();
      }

      const category =
        await transaction.category.findFirst({
          where: {
            id: input.categoryId,
            clientId,
            isActive: true,
          },
        });

      if (!category) {
        throw new InvalidProductCategoryError();
      }

      return transaction.product.create({
        data: {
          name: input.name,
          description:
            input.description || null,
          priceCents: input.priceCents,
          imageUrl: input.imageUrl || null,
          isAvailable: input.isAvailable,
          categoryId: category.id,
          clientId,
        },
      });
    },
  );

  await createAuditLog({
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    actorId: user.id,
    clientId: product.clientId,
    description: "Produto criado.",
    metadata: {
      name: product.name,
      priceCents: product.priceCents,
    },
  });

  return product;
}

export async function updateProductForUser(
  user: TenantUser,
  productId: string,
  rawInput: unknown,
) {
  const input =
    productUpdateSchema.parse(rawInput);

  const product = await prisma.$transaction(
    async (transaction) => {
      const existingProduct =
        await transaction.product.findFirst({
          where: {
            id: productId,
            ...getTenantFilter(user),
          },
        });

      if (!existingProduct) {
        throw new ProductNotFoundError();
      }

      if (input.categoryId) {
        const category =
          await transaction.category.findFirst({
            where: {
              id: input.categoryId,
              clientId:
                existingProduct.clientId,
              isActive: true,
            },
          });

        if (!category) {
          throw new InvalidProductCategoryError();
        }
      }

      return transaction.product.update({
        where: {
          id: existingProduct.id,
        },
        data: {
          ...(input.name !== undefined && {
            name: input.name,
          }),
          ...(input.description !== undefined && {
            description:
              input.description || null,
          }),
          ...(input.priceCents !== undefined && {
            priceCents: input.priceCents,
          }),
          ...(input.imageUrl !== undefined && {
            imageUrl: input.imageUrl,
          }),
          ...(input.isAvailable !== undefined && {
            isAvailable: input.isAvailable,
          }),
          ...(input.categoryId !== undefined && {
            categoryId: input.categoryId,
          }),
        },
      });
    },
  );

  await createAuditLog({
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: product.id,
    actorId: user.id,
    clientId: product.clientId,
    description: "Produto atualizado.",
  });

  return product;
}

export async function setCategoryActiveForUser(
  user: TenantUser,
  categoryId: string,
  isActive: boolean,
) {
  const existingCategory =
    await prisma.category.findFirst({
      where: {
        id: categoryId,
        ...getTenantFilter(user),
      },
    });

  if (!existingCategory) {
    throw new CategoryNotFoundError();
  }

  const category = await prisma.category.update({
    where: {
      id: existingCategory.id,
    },
    data: {
      isActive,
    },
  });

  await createAuditLog({
    action: isActive
      ? "CATEGORY_ACTIVATED"
      : "CATEGORY_DEACTIVATED",
    entityType: "Category",
    entityId: category.id,
    actorId: user.id,
    clientId: category.clientId,
    description: isActive
      ? "Categoria ativada."
      : "Categoria desativada.",
  });

  return category;
}

export async function setProductActiveForUser(
  user: TenantUser,
  productId: string,
  isActive: boolean,
) {
  const existingProduct =
    await prisma.product.findFirst({
      where: {
        id: productId,
        ...getTenantFilter(user),
      },
    });

  if (!existingProduct) {
    throw new ProductNotFoundError();
  }

  const product = await prisma.product.update({
    where: {
      id: existingProduct.id,
    },
    data: {
      isActive,
      ...(!isActive && {
        isAvailable: false,
      }),
    },
  });

  await createAuditLog({
    action: isActive
      ? "PRODUCT_ACTIVATED"
      : "PRODUCT_DEACTIVATED",
    entityType: "Product",
    entityId: product.id,
    actorId: user.id,
    clientId: product.clientId,
    description: isActive
      ? "Produto ativado."
      : "Produto desativado.",
  });

  return product;
}
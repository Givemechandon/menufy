import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  getTenantFilter,
  resolveClientId,
  type TenantUser,
} from "@/lib/auth/tenant";

const MAX_TRANSACTION_ATTEMPTS = 3;

const createMenuSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome do cardápio.")
    .max(80, "O nome é muito longo."),

  slug: z
    .string()
    .trim()
    .min(3, "O endereço deve ter pelo menos 3 caracteres.")
    .max(80, "O endereço é muito longo."),

  description: z
    .string()
    .trim()
    .max(500, "A descrição é muito longa.")
    .optional(),

  theme: z
    .enum(["LIGHT", "DARK"])
    .default("LIGHT"),

  primaryColor: z
    .string()
    .regex(
      /^#[0-9A-Fa-f]{6}$/,
      "Informe uma cor hexadecimal válida.",
    )
    .optional(),

  clientId: z
    .string()
    .min(1)
    .optional(),
});

export class PlanLimitError extends Error {
  readonly statusCode = 409;

  constructor(readonly maxMenus: number) {
    super(
      `O plano atual permite até ${maxMenus} cardápio(s).`,
    );

    this.name = "PlanLimitError";
  }
}

export class MenuSlugAlreadyExistsError extends Error {
  readonly statusCode = 409;

  constructor() {
    super("Este endereço de cardápio já está em uso.");
    this.name = "MenuSlugAlreadyExistsError";
  }
}

export class ClientInactiveError extends Error {
  readonly statusCode = 403;

  constructor() {
    super("Este cliente está inativo.");
    this.name = "ClientInactiveError";
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

export async function createMenuForUser(
  user: TenantUser,
  rawInput: unknown,
) {
  const parsedInput =
    createMenuSchema.parse(rawInput);

  const slug = normalizeSlug(parsedInput.slug);

  if (slug.length < 3) {
    throw new Error(
      "O endereço informado não gera um slug válido.",
    );
  }

  const clientId = resolveClientId(
    user,
    parsedInput.clientId,
  );

  for (
    let attempt = 1;
    attempt <= MAX_TRANSACTION_ATTEMPTS;
    attempt++
  ) {
    try {
      const menu = await prisma.$transaction(
        async (transaction) => {
          const client =
            await transaction.client.findUnique({
              where: {
                id: clientId,
              },
              include: {
                plan: true,
              },
            });

          if (!client || !client.isActive) {
            throw new ClientInactiveError();
          }

          const existingSlug =
            await transaction.menu.findUnique({
              where: {
                slug,
              },
              select: {
                id: true,
              },
            });

          if (existingSlug) {
            throw new MenuSlugAlreadyExistsError();
          }

          const currentMenus =
            await transaction.menu.count({
              where: {
                clientId,
                status: {
                  not: "ARCHIVED",
                },
              },
            });

          if (
            currentMenus >= client.plan.maxMenus
          ) {
            throw new PlanLimitError(
              client.plan.maxMenus,
            );
          }

          return transaction.menu.create({
            data: {
              name: parsedInput.name,
              slug,
              description:
                parsedInput.description || null,
              theme: parsedInput.theme,
              primaryColor:
                parsedInput.primaryColor || null,
              clientId,
              status: "DRAFT",
            },
          });
        },
        {
          isolationLevel: "Serializable",
        },
      );

      await createAuditLog({
        action: "MENU_CREATED",
        status: "SUCCESS",
        severity: "INFO",
        entityType: "Menu",
        entityId: menu.id,
        actorId: user.id,
        clientId,
        description: "Cardápio criado.",
        metadata: {
          name: menu.name,
          slug: menu.slug,
        },
      });

      return menu;
    } catch (error) {
      const errorCode = getErrorCode(error);

      if (errorCode === "P2002") {
        throw new MenuSlugAlreadyExistsError();
      }

      if (
        errorCode === "P2034" &&
        attempt < MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Não foi possível criar o cardápio.",
  );
}

const updateMenuSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Informe o nome do cardápio.")
      .max(80, "O nome é muito longo.")
      .optional(),

    slug: z
      .string()
      .trim()
      .min(3, "O endereço é muito curto.")
      .max(80, "O endereço é muito longo.")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "A descrição é muito longa.")
      .nullable()
      .optional(),

    theme: z
      .enum(["LIGHT", "DARK"])
      .optional(),

    primaryColor: z
      .union([
        z
          .string()
          .regex(
            /^#[0-9A-Fa-f]{6}$/,
            "Informe uma cor hexadecimal válida.",
          ),
        z.null(),
      ])
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

export class MenuNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Cardápio não encontrado.");
    this.name = "MenuNotFoundError";
  }
}

export class MenuCannotBePublishedError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "MenuCannotBePublishedError";
  }
}

export async function updateMenuForUser(
  user: TenantUser,
  menuId: string,
  rawInput: unknown,
) {
  const input = updateMenuSchema.parse(rawInput);

  const normalizedSlug = input.slug
    ? normalizeSlug(input.slug)
    : undefined;

  if (
    normalizedSlug !== undefined &&
    normalizedSlug.length < 3
  ) {
    throw new Error(
      "O endereço informado não gera um slug válido.",
    );
  }

  try {
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

        if (normalizedSlug) {
          const slugInUse =
            await transaction.menu.findFirst({
              where: {
                slug: normalizedSlug,
                id: {
                  not: menuId,
                },
              },
              select: {
                id: true,
              },
            });

          if (slugInUse) {
            throw new MenuSlugAlreadyExistsError();
          }
        }

        return transaction.menu.update({
          where: {
            id: existingMenu.id,
          },
          data: {
            ...(input.name !== undefined && {
              name: input.name,
            }),

            ...(normalizedSlug !== undefined && {
              slug: normalizedSlug,
            }),

            ...(input.description !== undefined && {
              description:
                input.description || null,
            }),

            ...(input.theme !== undefined && {
              theme: input.theme,
            }),

            ...(input.primaryColor !== undefined && {
              primaryColor: input.primaryColor,
            }),
          },
        });
      },
    );

    await createAuditLog({
      action: "MENU_UPDATED",
      status: "SUCCESS",
      severity: "INFO",
      entityType: "Menu",
      entityId: menu.id,
      actorId: user.id,
      clientId: menu.clientId,
      description: "Cardápio atualizado.",
      metadata: {
        changedFields:
          Object.keys(input).join(","),
      },
    });

    return menu;
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      throw new MenuSlugAlreadyExistsError();
    }

    throw error;
  }
}

export async function publishMenuForUser(
  user: TenantUser,
  menuId: string,
) {
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

      if (existingMenu.status === "PUBLISHED") {
        return existingMenu;
      }

      if (existingMenu.status === "ARCHIVED") {
        throw new MenuCannotBePublishedError(
          "Um cardápio arquivado não pode ser publicado.",
        );
      }

      const [
        visibleCategories,
        visibleProducts,
      ] = await Promise.all([
        transaction.menuCategory.count({
          where: {
            menuId: existingMenu.id,
            isVisible: true,
          },
        }),

        transaction.menuProduct.count({
          where: {
            menuId: existingMenu.id,
            isVisible: true,
          },
        }),
      ]);

      if (visibleCategories === 0) {
        throw new MenuCannotBePublishedError(
          "Adicione ao menos uma categoria visível.",
        );
      }

      if (visibleProducts === 0) {
        throw new MenuCannotBePublishedError(
          "Adicione ao menos um produto visível.",
        );
      }

      return transaction.menu.update({
        where: {
          id: existingMenu.id,
        },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
    },
  );

  await createAuditLog({
    action: "MENU_PUBLISHED",
    status: "SUCCESS",
    severity: "INFO",
    entityType: "Menu",
    entityId: menu.id,
    actorId: user.id,
    clientId: menu.clientId,
    description: "Cardápio publicado.",
  });

  return menu;
}

export async function archiveMenuForUser(
  user: TenantUser,
  menuId: string,
) {
  const existingMenu =
    await prisma.menu.findFirst({
      where: {
        id: menuId,
        ...getTenantFilter(user),
      },
    });

  if (!existingMenu) {
    throw new MenuNotFoundError();
  }

  if (existingMenu.status === "ARCHIVED") {
    return existingMenu;
  }

  const menu = await prisma.menu.update({
    where: {
      id: existingMenu.id,
    },
    data: {
      status: "ARCHIVED",
    },
  });

  await createAuditLog({
    action: "MENU_ARCHIVED",
    status: "SUCCESS",
    severity: "INFO",
    entityType: "Menu",
    entityId: menu.id,
    actorId: user.id,
    clientId: menu.clientId,
    description: "Cardápio arquivado.",
  });

  return menu;
}
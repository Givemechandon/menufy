import { prisma } from "@/lib/prisma";

export async function getPublicMenuBySlug(
  slug: string,
) {
  return prisma.menu.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      client: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      bannerUrl: true,
      theme: true,
      primaryColor: true,
      publishedAt: true,

      menuCategories: {
        where: {
          isVisible: true,
          category: {
            is: {
              isActive: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          sortOrder: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      },

      menuProducts: {
        where: {
          isVisible: true,
          product: {
            is: {
              isActive: true,
              category: {
                is: {
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          sortOrder: true,
          customPriceCents: true,
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              priceCents: true,
              imageUrl: true,
              isAvailable: true,
              categoryId: true,
            },
          },
        },
      },
    },
  });
}
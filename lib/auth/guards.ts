import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const getAuthenticatedUser = cache(async () => {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const databaseUser =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        role: true,
        clientId: true,
        isActive: true,
        client: {
          select: {
            isActive: true,
          },
        },
      },
    });

  if (!databaseUser || !databaseUser.isActive) {
    redirect("/access-disabled");
  }

  if (
    databaseUser.role === "CLIENT_ADMIN" &&
    (!databaseUser.clientId ||
      !databaseUser.client?.isActive)
  ) {
    redirect("/access-disabled");
  }

  return {
    ...session.user,
    id: databaseUser.id,
    role: databaseUser.role,
    clientId: databaseUser.clientId,
  };
});

export async function requireAuthenticatedUser() {
  return getAuthenticatedUser();
}

export async function requireSuperAdmin() {
  const user = await requireAuthenticatedUser();

  if (user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return user;
}

export async function requireClientAdmin() {
  const user = await requireAuthenticatedUser();

  if (user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  if (
    user.role !== "CLIENT_ADMIN" ||
    !user.clientId
  ) {
    redirect("/access-disabled");
  }

  return {
    ...user,
    clientId: user.clientId,
  };
}
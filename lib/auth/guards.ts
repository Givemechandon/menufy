import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAuthenticatedUser() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
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
    redirect("/login");
  }

  return {
    ...user,
    clientId: user.clientId,
  };
}
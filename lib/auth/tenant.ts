type TenantUser = {
  role: "SUPER_ADMIN" | "CLIENT_ADMIN";
  clientId: string | null;
};

export class ForbiddenError extends Error {
  constructor() {
    super("Acesso não autorizado.");
    this.name = "ForbiddenError";
  }
}

export function assertClientOwnership(
  user: TenantUser,
  resourceClientId: string,
) {
  if (user.role === "SUPER_ADMIN") {
    return;
  }

  if (
    !user.clientId ||
    user.clientId !== resourceClientId
  ) {
    throw new ForbiddenError();
  }
}

export function getClientIdFromUser(
  user: TenantUser,
) {
  if (
    user.role !== "CLIENT_ADMIN" ||
    !user.clientId
  ) {
    throw new ForbiddenError();
  }

  return user.clientId;
}
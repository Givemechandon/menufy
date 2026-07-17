export type TenantUser = {
  id?: string;
  role: "SUPER_ADMIN" | "CLIENT_ADMIN";
  clientId: string | null;
};

export class ForbiddenError extends Error {
  readonly statusCode = 403;

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

export function getTenantFilter(
  user: TenantUser,
): { clientId?: string } {
  if (user.role === "SUPER_ADMIN") {
    return {};
  }

  return {
    clientId: getClientIdFromUser(user),
  };
}

export function resolveClientId(
  user: TenantUser,
  requestedClientId?: string | null,
) {
  if (user.role === "CLIENT_ADMIN") {
    const clientId = getClientIdFromUser(user);

    if (
      requestedClientId &&
      requestedClientId !== clientId
    ) {
      throw new ForbiddenError();
    }

    return clientId;
  }

  if (
    user.role === "SUPER_ADMIN" &&
    requestedClientId
  ) {
    return requestedClientId;
  }

  throw new ForbiddenError();
}
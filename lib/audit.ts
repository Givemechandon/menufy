import { headers } from "next/headers";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { captureAppError } from "@/lib/error-logger";

type AuditStatus = "SUCCESS" | "FAILURE";

type AuditSeverity =
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "CRITICAL";

type CreateAuditLogInput = {
  action: string;
  status?: AuditStatus;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  clientId?: string | null;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

async function getRequestContext() {
  try {
    const requestHeaders = await headers();

    const forwardedFor =
      requestHeaders.get("x-forwarded-for");

    return {
      ipAddress:
        forwardedFor?.split(",")[0]?.trim() ??
        requestHeaders.get("x-real-ip"),
      userAgent:
        requestHeaders.get("user-agent"),
      requestId:
        requestHeaders.get("x-vercel-id") ??
        requestHeaders.get("x-request-id"),
    };
  } catch {
    return {
      ipAddress: null,
      userAgent: null,
      requestId: null,
    };
  }
}

export async function createAuditLog(
  input: CreateAuditLogInput,
) {
  const requestContext = await getRequestContext();

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        status: input.status ?? "SUCCESS",
        severity: input.severity ?? "INFO",
        entityType: input.entityType,
        entityId: input.entityId,
        description: input.description,
        metadata: input.metadata,
        clientId: input.clientId,
        actorId: input.actorId,
        ipAddress:
          input.ipAddress ?? requestContext.ipAddress,
        userAgent:
          input.userAgent ?? requestContext.userAgent,
        requestId:
          input.requestId ?? requestContext.requestId,
      },
    });
    } catch (error) {
    await captureAppError(error, {
      source: "audit-log",
      severity: "CRITICAL",
      clientId: input.clientId,
      userId: input.actorId,
      metadata: {
        action: input.action,
      },
    });
  }
}
import { headers } from "next/headers";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type ErrorSeverity =
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "CRITICAL";

type ErrorMetadataValue =
  | string
  | number
  | boolean
  | null;

type CaptureErrorContext = {
  source: string;
  severity?: ErrorSeverity;
  code?: string;
  route?: string;
  method?: string;
  clientId?: string | null;
  userId?: string | null;
  metadata?: Record<string, ErrorMetadataValue>;
};

const sensitiveKeyPattern =
  /password|token|secret|authorization|cookie|database.?url/i;

function redactText(value: string, maxLength: number) {
  return value
    .replace(
      /(bearer\s+)[^\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /((?:password|token|secret|authorization)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /postgres(?:ql)?:\/\/[^@\s]+@/gi,
      "postgresql://[REDACTED]@",
    )
    .slice(0, maxLength);
}

function sanitizeMetadata(
  metadata?: Record<string, ErrorMetadataValue>,
): Prisma.InputJsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<
    string,
    ErrorMetadataValue
  > = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeyPattern.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    sanitized[key] =
      typeof value === "string"
        ? redactText(value, 1000)
        : value;
  }

  return sanitized;
}

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

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    const errorWithCode = error as Error & {
      code?: unknown;
    };

    return {
      message: redactText(error.message, 4000),
      stack: error.stack
        ? redactText(error.stack, 20000)
        : undefined,
      code:
        typeof errorWithCode.code === "string"
          ? redactText(errorWithCode.code, 255)
          : undefined,
    };
  }

  return {
    message: redactText(String(error), 4000),
    stack: undefined,
    code: undefined,
  };
}

export async function captureAppError(
  error: unknown,
  context: CaptureErrorContext,
) {
  const normalized = normalizeError(error);
  const requestContext = await getRequestContext();

  const severity: ErrorSeverity =
    context.severity ?? "ERROR";

  const payload = {
    severity,
    source: context.source,
    message: normalized.message,
    stack: normalized.stack,
    code: context.code ?? normalized.code,
    route: context.route,
    method: context.method,
    requestId: requestContext.requestId,
    environment:
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
    clientId: context.clientId,
    userId: context.userId,
    metadata: sanitizeMetadata(context.metadata),
  };

  console.error(
    JSON.stringify({
      type: "application_error",
      ...payload,
    }),
  );

  try {
    await prisma.errorLog.create({
      data: payload,
    });
  } catch (persistenceError) {
    console.error(
      JSON.stringify({
        type: "error_log_persistence_failed",
        originalMessage: normalized.message,
        persistenceMessage:
          persistenceError instanceof Error
            ? redactText(
                persistenceError.message,
                2000,
              )
            : "Falha desconhecida ao persistir erro.",
      }),
    );
  }
}
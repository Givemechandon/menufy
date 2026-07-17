import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { captureAppError } from "@/lib/error-logger";

const WINDOW_MINUTES = 15;
const MAX_EMAIL_FAILURES = 10;
const MAX_IP_FAILURES = 30;

type LoginRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: "EMAIL" | "IP" | null;
};

async function getClientIp() {
  const requestHeaders = await headers();
  const forwardedFor =
    requestHeaders.get("x-forwarded-for");

  return (
    forwardedFor?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip")
  );
}

export async function checkLoginRateLimit(
  email: string,
): Promise<LoginRateLimitResult> {
  const windowStart = new Date(
    Date.now() - WINDOW_MINUTES * 60 * 1000,
  );

  try {
    const ipAddress = await getClientIp();

    const emailFailuresPromise =
      prisma.auditLog.count({
        where: {
          action: "AUTH_LOGIN_FAILED",
          status: "FAILURE",
          entityType: "LOGIN_EMAIL",
          entityId: email,
          createdAt: {
            gte: windowStart,
          },
        },
      });

    const ipFailuresPromise = ipAddress
      ? prisma.auditLog.count({
          where: {
            action: "AUTH_LOGIN_FAILED",
            status: "FAILURE",
            ipAddress,
            createdAt: {
              gte: windowStart,
            },
          },
        })
      : Promise.resolve(0);

    const [emailFailures, ipFailures] =
      await Promise.all([
        emailFailuresPromise,
        ipFailuresPromise,
      ]);

    if (emailFailures >= MAX_EMAIL_FAILURES) {
      return {
        allowed: false,
        retryAfterSeconds: WINDOW_MINUTES * 60,
        reason: "EMAIL",
      };
    }

    if (ipFailures >= MAX_IP_FAILURES) {
      return {
        allowed: false,
        retryAfterSeconds: WINDOW_MINUTES * 60,
        reason: "IP",
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      reason: null,
    };
  } catch (error) {
    await captureAppError(error, {
      source: "login-rate-limit",
      severity: "ERROR",
    });

    // Se o controle falhar, a autenticação normal continua.
    return {
      allowed: true,
      retryAfterSeconds: 0,
      reason: null,
    };
  }
}
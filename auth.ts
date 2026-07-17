import NextAuth, {
  type DefaultSession,
} from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { checkLoginRateLimit } from "@/lib/auth/login-rate-limit";

type MenuFyUserRole =
  | "SUPER_ADMIN"
  | "CLIENT_ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: MenuFyUserRole;
      clientId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: MenuFyUserRole;
    clientId: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: MenuFyUserRole;
    clientId: string | null;
  }
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

async function registerFailedLogin({
  email,
  reason,
  clientId,
}: {
  email: string;
  reason: string;
  clientId?: string | null;
}) {
  await createAuditLog({
    action: "AUTH_LOGIN_FAILED",
    status: "FAILURE",
    severity: "WARNING",
    entityType: "LOGIN_EMAIL",
    entityId: email,
    clientId,
    description: "Tentativa de login recusada.",
    metadata: {
      reason,
    },
  });
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      credentials: {
        email: {
          label: "E-mail",
          type: "email",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },

      async authorize(credentials) {
        const result =
          loginSchema.safeParse(credentials);

        if (!result.success) {
          await createAuditLog({
            action: "AUTH_LOGIN_INVALID_INPUT",
            status: "FAILURE",
            severity: "WARNING",
            description:
              "Formato inválido enviado ao login.",
          });

          return null;
        }

        const email =
          result.data.email.toLowerCase();
        const password = result.data.password;

        const rateLimit =
          await checkLoginRateLimit(email);

        if (!rateLimit.allowed) {
          await createAuditLog({
            action: "AUTH_LOGIN_BLOCKED",
            status: "FAILURE",
            severity: "WARNING",
            entityType: "LOGIN_EMAIL",
            entityId: email,
            description:
              "Login temporariamente bloqueado.",
            metadata: {
              reason: rateLimit.reason,
              retryAfterSeconds:
                rateLimit.retryAfterSeconds,
            },
          });

          return null;
        }

        const user =
          await prisma.user.findUnique({
            where: {
              email,
            },
            include: {
              client: true,
            },
          });

        if (!user || !user.isActive) {
          await registerFailedLogin({
            email,
            reason: "INVALID_CREDENTIALS",
          });

          return null;
        }

        if (
          user.role === "CLIENT_ADMIN" &&
          (!user.client ||
            !user.client.isActive)
        ) {
          await registerFailedLogin({
            email,
            reason: "CLIENT_INACTIVE",
            clientId: user.clientId,
          });

          return null;
        }

        const validPassword = await compare(
          password,
          user.passwordHash,
        );

        if (!validPassword) {
          await registerFailedLogin({
            email,
            reason: "INVALID_CREDENTIALS",
            clientId: user.clientId,
          });

          return null;
        }

        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            lastLoginAt: new Date(),
          },
        });

        await createAuditLog({
          action: "AUTH_LOGIN_SUCCESS",
          status: "SUCCESS",
          severity: "INFO",
          entityType: "User",
          entityId: user.id,
          actorId: user.id,
          clientId: user.clientId,
          description:
            "Login realizado com sucesso.",
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clientId = user.clientId;
      }

      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.clientId =
        token.clientId;

      return session;
    },
  },
});
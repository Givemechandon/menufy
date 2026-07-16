import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type MenuFyUserRole = "SUPER_ADMIN" | "CLIENT_ADMIN";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        const result = loginSchema.safeParse(credentials);

        if (!result.success) {
          return null;
        }

        const email = result.data.email.toLowerCase();
        const password = result.data.password;

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          include: {
            client: true,
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        if (
          user.role === "CLIENT_ADMIN" &&
          (!user.client || !user.client.isActive)
        ) {
          return null;
        }

        const validPassword = await compare(
          password,
          user.passwordHash,
        );

        if (!validPassword) {
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
      session.user.clientId = token.clientId;

      return session;
    },
  },
});

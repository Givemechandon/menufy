"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { captureAppError } from "@/lib/error-logger";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido."),

  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(72),
});

export type LoginActionState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return {
      error:
        result.error.issues[0]?.message ??
        "Verifique os dados informados.",
    };
  }

  try {
    await signIn("credentials", {
      email: result.data.email,
      password: result.data.password,
      redirectTo: "/dashboard",
    });

    return {
      error: null,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return {
          error: "E-mail ou senha inválidos.",
        };
      }

      await captureAppError(error, {
        source: "login-action",
        severity: "ERROR",
      });

      return {
        error:
          "Não foi possível entrar agora. Tente novamente.",
      };
    }

    // O redirecionamento do Next.js também é lançado
    // como uma exceção interna e precisa continuar.
    throw error;
  }
}
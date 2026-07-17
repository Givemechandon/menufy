"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  LoaderCircle,
  LogIn,
} from "lucide-react";
import {
  loginAction,
  type LoginActionState,
} from "@/features/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginActionState = {
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="h-11 w-full font-semibold"
      disabled={pending}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Entrando...
        </>
      ) : (
        <>
          <LogIn />
          Entrar
        </>
      )}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>

        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          required
          className="h-11 bg-white"
          aria-invalid={Boolean(state.error)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>

        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Digite sua senha"
          autoComplete="current-password"
          required
          minLength={8}
          maxLength={72}
          className="h-11 bg-white"
          aria-invalid={Boolean(state.error)}
        />
      </div>

      {state.error && (
        <Alert
          variant="destructive"
          role="alert"
        >
          <AlertCircle />
          <AlertDescription>
            {state.error}
          </AlertDescription>
        </Alert>
      )}

      <SubmitButton />
    </form>
  );
}
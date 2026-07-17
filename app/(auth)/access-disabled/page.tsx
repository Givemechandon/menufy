import Image from "next/image";
import {
  Headphones,
  LogOut,
  ShieldX,
} from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AccessDisabledPage() {
  const supportUrl =
    process.env.NEXT_PUBLIC_SUPPORT_URL;

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-background px-5 py-10">
      <div className="absolute -left-40 -top-40 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative h-16 w-52">
        <Image
            src="/brand/menufy-logo.png"
            alt="MenuFy"
            fill
            priority
            unoptimized
            sizes="208px"
            className="object-contain p-3"
        />
      </div>

      <Card className="relative w-full max-w-md text-center shadow-xl shadow-black/5">
        <CardHeader className="items-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldX className="size-7" />
          </div>

          <CardTitle className="text-2xl">
            Acesso indisponível
          </CardTitle>

          <CardDescription className="max-w-sm">
            Sua conta ou empresa está inativa.
            Entre em contato com o suporte MenuFy
            para verificar seu acesso.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {supportUrl ? (
            <Button
              className="w-full"
              asChild
            >
              <a
                href={supportUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Headphones />
                Acionar suporte
              </a>
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled
            >
              <Headphones />
              Suporte ainda não configurado
            </Button>
          )}

          <form
            action={async () => {
              "use server";

              await signOut({
                redirectTo: "/login",
              });
            }}
          >
            <Button
              type="submit"
              variant="outline"
              className="w-full"
            >
              <LogOut />
              Sair da conta
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="relative text-center text-sm text-muted-foreground">
        MenuFy — Cardápios digitais
      </p>
    </main>
  );
}
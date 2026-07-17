import Image from "next/image";
import { redirect } from "next/navigation";
import { Headphones, QrCode, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
  }

  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-40 -left-32 size-96 rounded-full bg-black/10" />

        <div className="absolute left-12 top-12 h-26 w-40 rounded-2xl shadow-lg">
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

        <div className="relative flex max-w-lg flex-1 flex-col justify-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
              Seu cardápio digital simples, bonito e sempre atualizado.
            </h1>

            <p className="text-lg text-white/80">
              Gerencie produtos, categorias e cardápios em um só lugar.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <QrCode className="size-5" />

              <span>QR Code gerado automaticamente</span>
            </div>

            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5" />

              <span>Dados protegidos e separados por cliente</span>
            </div>
          </div>
        </div>

        <p className="relative text-sm text-white/60">
          MenuFy — Cardápios digitais
        </p>
      </section>

      <section className="relative flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#EA1D2C] lg:hidden"
        />

        <div className="relative w-full max-w-md space-y-6">
          <div className="flex justify-center lg:hidden">
            <Image
              src="/brand/menufy-logo.png"
              alt="MenuFy"
              width={208}
              height={126}
              priority
              unoptimized
              className="h-auto w-52 object-contain"
            />
          </div>

          <Card className="border-border/70 shadow-xl shadow-black/5">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Acesse sua conta</CardTitle>

              <CardDescription>
                Entre com os dados fornecidos pela equipe MenuFy.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <LoginForm />
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t bg-muted/40">
              <p className="text-center text-sm text-muted-foreground">
                Ainda não possui acesso?
              </p>

              {supportUrl ? (
                <Button variant="outline" className="w-full" asChild>
                  <a href={supportUrl} target="_blank" rel="noreferrer">
                    <Headphones />
                    Acionar suporte
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  <Headphones />
                  Suporte ainda não configurado
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </section>
    </main>
  );
}

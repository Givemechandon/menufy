import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const adapter = new PrismaNeon({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function createPlans() {
  const plans = [
    {
      name: "Gratuito",
      slug: "free",
      maxMenus: 2,
      priceCents: 0,
      isActive: true,
    },
    {
      name: "Premium",
      slug: "premium",
      maxMenus: 20,
      priceCents: 0,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {
        slug: plan.slug,
      },
      update: {},
      create: plan,
    });
  }
}

async function createSuperAdmin() {
  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("As variáveis do Super Admin não foram configuradas.");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    console.log("Super Admin já existe. Nenhuma alteração foi realizada.");
    return;
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log("Super Admin criado com sucesso.");
}

async function main() {
  await createPlans();
  await createSuperAdmin();

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
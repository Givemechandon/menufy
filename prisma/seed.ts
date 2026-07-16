import "dotenv/config";
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

async function main() {
  await prisma.plan.upsert({
    where: {
      slug: "free",
    },
    update: {
      name: "Gratuito",
      maxMenus: 2,
      priceCents: 0,
      isActive: true,
    },
    create: {
      name: "Gratuito",
      slug: "free",
      maxMenus: 2,
      priceCents: 0,
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: {
      slug: "premium",
    },
    update: {
      name: "Premium",
      maxMenus: 20,
      priceCents: 0,
      isActive: true,
    },
    create: {
      name: "Premium",
      slug: "premium",
      maxMenus: 20,
      priceCents: 0,
      isActive: true,
    },
  });

  console.log("Planos iniciais criados com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
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

  console.log("Planos iniciais verificados com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
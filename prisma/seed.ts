import { PrismaClient } from "@prisma/client";
import { seedDatabase, DEMO_PASSWORD } from "../src/lib/seedData";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(async () => {
    console.log("Seed complete:", {
      demoLogin: `sara@sunaidiexpo.com / ${DEMO_PASSWORD} (MFA code: 123456)`,
    });
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

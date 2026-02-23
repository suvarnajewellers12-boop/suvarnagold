import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Running seed...");

  const hashedPassword = await bcrypt.hash("superadmin123", 10);

  await prisma.superAdmin.create({
    data: {
      username: "superadmin",
      password: hashedPassword,
    },
  });

  console.log("✅ Super Admin created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

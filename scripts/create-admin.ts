import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME?.trim() || "Administrator";

if (!databaseUrl) {
  throw new Error("DATABASE_URL lipsește.");
}

if (!adminEmail) {
  throw new Error("ADMIN_EMAIL lipsește.");
}

if (!adminPassword || adminPassword.length < 12) {
  throw new Error("Parola trebuie să aibă minimum 12 caractere.");
}

const validatedEmail: string = adminEmail;
const validatedPassword: string = adminPassword;

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hash(validatedPassword, 12);

  const user = await prisma.user.upsert({
    where: {
      email: validatedEmail,
    },
    update: {
      name: adminName,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      name: adminName,
      email: validatedEmail,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Administrator creat: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

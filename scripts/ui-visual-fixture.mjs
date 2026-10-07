import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const name = "Codex UI Visual";

try {
  if (process.argv[2] === "cleanup") {
    await db.user.deleteMany({ where: { name } });
    process.stdout.write("cleaned");
  } else {
    const family = await db.family.findFirst({ orderBy: { createdAt: "asc" } });
    if (!family) throw new Error("Keine lokale Entwicklungsfamilie vorhanden.");
    await db.user.deleteMany({ where: { name } });
    const user = await db.user.create({
      data: {
        name,
        passwordHash: await bcrypt.hash("codex-ui-visual-only", 12),
        memberships: { create: { familyId: family.id, role: "ADMIN", status: "ACTIVE" } }
      }
    });
    process.stdout.write(user.id);
  }
} finally {
  await db.$disconnect();
}

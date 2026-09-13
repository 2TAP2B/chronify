import "@/lib/load-env";
import { db } from "../src/lib/db";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { encryptFile, isEncrypted } from "../src/lib/file-crypto";

async function main() {
  if (!process.env.AU_CERT_ENCRYPTION_KEY) {
    console.error("ERROR: AU_CERT_ENCRYPTION_KEY not set. Generate with: openssl rand -hex 32");
    process.exit(1);
  }

  const sickNotes = await db.sickNote.findMany({
    where: { certificateUrl: { not: null } },
    select: { id: true, certificateUrl: true },
  });

  console.log(`Found ${sickNotes.length} sick notes with certificates`);

  let encrypted = 0;
  let skipped = 0;
  let missing = 0;

  for (const note of sickNotes) {
    if (!note.certificateUrl) continue;
    const filePath = note.certificateUrl.replace(/^file:/, "");
    if (!existsSync(filePath)) {
      console.warn(`  MISSING: ${filePath}`);
      missing++;
      continue;
    }

    const buffer = await readFile(filePath);

    if (isEncrypted(buffer)) {
      console.log(`  SKIP (already encrypted): ${filePath}`);
      skipped++;
      continue;
    }

    const encryptedBuffer = encryptFile(buffer);
    await writeFile(filePath, encryptedBuffer);
    encrypted++;
    console.log(`  ENCRYPTED: ${filePath}`);
  }

  console.log(`\nDone: ${encrypted} encrypted, ${skipped} skipped, ${missing} missing`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

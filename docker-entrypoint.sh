#!/bin/sh
set -e

echo "==> Running prisma migrate deploy"
npx prisma migrate deploy

echo "==> Seeding if needed"
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const c = await prisma.user.count();
  console.log(c);
  await prisma.\$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "Database empty, running seed…"
  tsx prisma/seed.ts
else
  echo "Database has $USER_COUNT users, skipping seed."
fi

echo "==> Starting Next.js"
exec "$@"

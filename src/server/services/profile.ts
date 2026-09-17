import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import type { Role } from "@prisma/client";

export type OwnProfile = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nfcCardId: string | null;
  role: Role;
  hireDate: Date | null;
  lastLoginAt: Date | null;
  hasPassword: boolean;
  avatarUrl: string | null;
};

export async function getOwnProfile(userId: string): Promise<OwnProfile> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      nfcCardId: true,
      role: true,
      hireDate: true,
      lastLoginAt: true,
      passwordHash: true,
      avatarUrl: true,
    },
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    nfcCardId: user.nfcCardId,
    role: user.role,
    hireDate: user.hireDate,
    lastLoginAt: user.lastLoginAt,
    hasPassword: user.passwordHash !== null && user.passwordHash !== "",
    avatarUrl: user.avatarUrl,
  };
}

export async function updateOwnProfile(opts: {
  actor: SessionUser;
  input: { firstName?: string | null; lastName?: string | null };
}): Promise<OwnProfile> {
  // Merge semantics: absent keys keep their current value (full replace is
  // reserved for explicit nulls).
  const current = await db.user.findUniqueOrThrow({
    where: { id: opts.actor.id },
    select: { firstName: true, lastName: true },
  });
  const firstName =
    opts.input.firstName !== undefined
      ? (opts.input.firstName ?? "").trim()
      : (current.firstName?.trim() ?? "");
  const lastName =
    opts.input.lastName !== undefined
      ? (opts.input.lastName ?? "").trim()
      : (current.lastName?.trim() ?? "");
  if (firstName === "" && lastName === "") {
    throw new Error("At least one name must be non-empty");
  }

  // `name` is the system display name (reports/CSV/team views); keep it in
  // sync with the parts. Normalize to NFC so look-alike Unicode forms don't
  // split team views into duplicates.
  const name = [firstName, lastName]
    .filter((v) => v !== "")
    .map((v) => v.normalize("NFC"))
    .join(" ");

  await db.user.update({
    where: { id: opts.actor.id },
    data: { firstName: firstName || null, lastName: lastName || null, name },
  });
  await audit({
    actorId: opts.actor.id,
    action: "profile.update",
    entity: "User",
    entityId: opts.actor.id,
    payload: { firstName, lastName },
  });
  return getOwnProfile(opts.actor.id);
}

const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const AVATAR_ALLOWED_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
];

export async function setOwnAvatar(opts: {
  actor: SessionUser;
  dataUrl: string | null;
}): Promise<OwnProfile> {
  let avatarUrl: string | null = null;
  if (opts.dataUrl !== null) {
    const url = opts.dataUrl;
    const ok = AVATAR_ALLOWED_PREFIXES.some((p) => url.startsWith(p));
    if (!ok) {
      const e = new Error("Invalid avatar type");
      (e as Error & { code: string }).code = "AVATAR_BAD_TYPE";
      throw e;
    }
    // Decode base64 size accurately (header = "data:...;base64,").
    const header = url.slice(0, url.indexOf(",") + 1);
    const decodedBytes = Math.floor(((url.length - header.length) * 3) / 4);
    if (decodedBytes > AVATAR_MAX_BYTES) {
      const e = new Error("Avatar too large (max 3 MB)");
      (e as Error & { code: string }).code = "AVATAR_TOO_LARGE";
      throw e;
    }
    avatarUrl = url;
  }
  await db.user.update({
    where: { id: opts.actor.id },
    data: { avatarUrl },
  });
  await audit({
    actorId: opts.actor.id,
    action: avatarUrl === null ? "profile.avatar.remove" : "profile.avatar.set",
    entity: "User",
    entityId: opts.actor.id,
  });
  return getOwnProfile(opts.actor.id);
}

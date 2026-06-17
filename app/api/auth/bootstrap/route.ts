import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function POST() {
  const { user, profile, ownerId } = await getAppUserContext();

  if (!user || !profile || !ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      role: profile.role,
      owner_id: profile.owner_id,
      name_th: profile.name_th,
      name_en: profile.name_en,
      email: user.email ?? null,
    },
    ownerId,
  });
}

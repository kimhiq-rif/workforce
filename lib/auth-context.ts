import type { User as AuthUser } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type AppProfile = {
  id: string;
  auth_id: string | null;
  owner_id: string | null;
  role: "owner" | "field_manager" | "technical_admin";
  name_th: string;
  name_en: string;
  must_change_password: boolean;
};

function fallbackName(user: AuthUser) {
  const metadataName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Owner";
  return String(metadataName);
}

export async function getAppUserContext() {
  const authClient = createClient();
  const serviceClient = createServiceClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { user: null, profile: null, ownerId: null, authClient, serviceClient };
  }

  const { data: existingProfile, error: profileError } = await serviceClient
    .from("users")
    .select("id, auth_id, owner_id, role, name_th, name_en, must_change_password")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (existingProfile) {
    const profile = existingProfile as AppProfile;
    return {
      user,
      profile,
      ownerId: profile.role === "owner" ? profile.id : profile.owner_id,
      authClient,
      serviceClient,
    };
  }

  const name = fallbackName(user);
  const { data: createdProfile, error: createError } = await serviceClient
    .from("users")
    .insert({
      auth_id: user.id,
      owner_id: null,
      role: "owner",
      name_th: name,
      name_en: name,
      language_mode: "th_en",
      session_timeout_hours: 1,
    })
    .select("id, auth_id, owner_id, role, name_th, name_en, must_change_password")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const profile = createdProfile as AppProfile;
  return { user, profile, ownerId: profile.id, authClient, serviceClient };
}

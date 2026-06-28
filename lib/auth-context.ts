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
  has_set_password: boolean;
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
    .select("id, auth_id, owner_id, role, name_th, name_en, must_change_password, has_set_password")
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

  // Only auto-create an owner profile when no profile exists AND the user has
  // no email domain that suggests they're a worker account. Workers are always
  // invited via /api/team/invite which creates their users row before first login.
  // If we reach here for a worker (invite DB insert failed), return null so the
  // app shows an error rather than silently granting owner access.
  const { data: workerCheck } = await serviceClient
    .from("workers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (workerCheck) {
    // Worker auth account exists but users row is missing — broken invite state.
    // Don't auto-create; return null so the caller can redirect to an error page.
    return { user: null, profile: null, ownerId: null, authClient, serviceClient };
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
    .select("id, auth_id, owner_id, role, name_th, name_en, must_change_password, has_set_password")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const profile = createdProfile as AppProfile;
  return { user, profile, ownerId: profile.id, authClient, serviceClient };
}

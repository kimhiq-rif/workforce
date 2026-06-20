// Copyright © 2026 Workforce. All rights reserved.
// POST → generate authentication options (no auth needed)
// PUT  → verify assertion → return Supabase session tokens

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

function getRpID(req: NextRequest): string {
  return req.headers.get("host")?.split(":")[0] ?? "localhost";
}

export async function POST(req: NextRequest) {
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

  const options = await generateAuthenticationOptions({
    rpID:             getRpID(req),
    userVerification: "required",
    allowCredentials: [],   // discoverable — browser picks from stored passkeys
  });

  const cookieStore = await cookies();
  cookieStore.set("wn_auth_challenge", options.challenge, {
    httpOnly: true, secure: true, sameSite: "strict", maxAge: 120,
  });

  return NextResponse.json(options);
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  const challenge = cookieStore.get("wn_auth_challenge")?.value;
  if (!challenge) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  cookieStore.delete("wn_auth_challenge");

  const body = await req.json();
  const service = createServiceClient();

  // Look up passkey by credential ID
  const { data: passkey } = await service
    .from("passkeys")
    .select("*")
    .eq("credential_id", body.id)
    .single();

  if (!passkey) return NextResponse.json({ error: "Passkey not found" }, { status: 404 });

  const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response:          body,
      expectedChallenge: challenge,
      expectedOrigin:    req.headers.get("origin") ?? "",
      expectedRPID:      getRpID(req),
      requireUserVerification: true,
      credential: {
        id:         passkey.credential_id,
        publicKey:  Buffer.from(passkey.public_key, "base64"),
        counter:    passkey.counter,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  // Update counter
  await service
    .from("passkeys")
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq("credential_id", passkey.credential_id);

  // Get user email to issue magic-link session
  const { data: { user } } = await service.auth.admin.getUserById(passkey.user_id);
  if (!user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Generate a one-time magic link token → client exchanges for session
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "Session error" }, { status: 500 });
  }

  return NextResponse.json({
    email:      user.email,
    token_hash: linkData.properties.hashed_token,  // client passes this to verifyOtp
  });
}

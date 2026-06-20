// Copyright © 2026 Workforce. All rights reserved.
// POST  → generate registration options (authenticated)
// PUT   → verify response + save passkey
// GET   → does current user have any passkeys?

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const RP_NAME = "Workforce";

function getRpID(req: NextRequest): string {
  return req.headers.get("host")?.split(":")[0] ?? "localhost";
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const { count } = await supabase
    .from("passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({ count: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { generateRegistrationOptions } =
    await import("@simplewebauthn/server");

  const { data: existing } = await supabase
    .from("passkeys")
    .select("credential_id")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName:   RP_NAME,
    rpID:     getRpID(req),
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "User",
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((p) => ({
      id: p.credential_id,
    })),
    authenticatorSelection: {
      residentKey:              "required",
      userVerification:         "required",
      authenticatorAttachment:  "platform",
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("wn_reg_challenge", options.challenge, {
    httpOnly: true, secure: true, sameSite: "strict", maxAge: 120,
  });

  return NextResponse.json(options);
}

export async function PUT(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const challenge = cookieStore.get("wn_reg_challenge")?.value;
  if (!challenge) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  cookieStore.delete("wn_reg_challenge");

  const body = await req.json();
  const { deviceName } = body;

  const { verifyRegistrationResponse } = await import("@simplewebauthn/server");

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response:             body,
      expectedChallenge:    challenge,
      expectedOrigin:       req.headers.get("origin") ?? "",
      expectedRPID:         getRpID(req),
      requireUserVerification: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  const service = createServiceClient();
  const { error } = await service.from("passkeys").insert({
    user_id:       user.id,
    credential_id: credential.id,
    public_key:    Buffer.from(credential.publicKey).toString("base64"),
    counter:       credential.counter,
    device_name:   deviceName ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

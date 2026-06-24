import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAppUserContext } from "@/lib/auth-context";

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchExamples(ownerId: string) {
  try {
    const { data } = await supabaseAdmin
      .from("receipt_ocr_examples")
      .select("correct_description, correct_amount, correct_merchant, correct_date")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}

function buildPrompt(examples: any[]) {
  let ex = "";
  if (examples.length > 0) {
    ex = "\n\nPast confirmed receipts from this business:\n";
    examples.forEach((e, i) => {
      ex += `${i + 1}. merchant="${e.correct_merchant ?? "unknown"}", description="${e.correct_description ?? ""}", amount=${e.correct_amount}\n`;
    });
  }
  return `Extract data from this Thai construction site receipt.${ex}

Rules:
- Thai Buddhist year: "69" = 2569 BE = 2026 CE. "6/6/69" → 2026-06-06.
- Amount: "3000-" or "3,000" = 3000. Strip commas, ignore trailing dash.
- Merchant: store/company name only. Generic "บิลเงินสด" forms have no merchant → null.
- Description: English summary of what was purchased (max 80 chars).
- confidence: 90=clearly readable, 70=uncertain, 40=guessing.

Respond with ONLY this JSON (no markdown, no explanation):
{"merchant":null,"description":"...","amount":0,"date":null,"confidence":0}`;
}

export async function POST(req: NextRequest) {
  // Always return 200 — errors go in the body so client can display them
  try {
    const { user: authUser, ownerId } = await getAppUserContext();
    if (!authUser || !ownerId) {
      return NextResponse.json({ amount: 0, confidence: 0, _err: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const { imageUrl, imageBase64 } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ amount: 0, confidence: 0, _err: "no image provided" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ amount: 0, confidence: 0, _err: "ANTHROPIC_API_KEY missing in Vercel env vars" });
    }

    const examples = ownerId ? await fetchExamples(ownerId) : [];

    let imageSource: any;
    if (imageBase64) {
      imageSource = { type: "base64", media_type: "image/jpeg", data: imageBase64 };
    } else {
      const imgFetch = await fetch(imageUrl);
      const imgBuf = await imgFetch.arrayBuffer();
      const b64 = Buffer.from(imgBuf).toString("base64");
      imageSource = { type: "base64", media_type: "image/jpeg", data: b64 };
    }

    let claudeStatus = 0;
    let rawText = "";
    let claudeErrMsg = "";

    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: imageSource },
              { type: "text", text: buildPrompt(examples) },
            ],
          }],
        }),
      });

      claudeStatus = claudeRes.status;
      const claudeData = await claudeRes.json();

      if (!claudeRes.ok || claudeData.type === "error") {
        claudeErrMsg = claudeData.error?.message ?? JSON.stringify(claudeData).slice(0, 200);
        return NextResponse.json({ amount: 0, confidence: 0, _err: `Claude ${claudeStatus}: ${claudeErrMsg}` });
      }

      rawText = claudeData.content?.[0]?.text ?? "";
    } catch (fetchErr: any) {
      return NextResponse.json({ amount: 0, confidence: 0, _err: `Claude fetch failed: ${fetchErr.message}` });
    }

    // Parse JSON from Claude response
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        return NextResponse.json({ amount: 0, confidence: 0, _err: `No JSON found. Claude said: "${rawText.slice(0, 100)}"` });
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        merchant: parsed.merchant ?? null,
        description: parsed.description ?? "",
        amount: Number(parsed.amount) || 0,
        date: parsed.date ?? null,
        confidence: Number(parsed.confidence) || 0,
      });
    } catch (parseErr: any) {
      return NextResponse.json({ amount: 0, confidence: 0, _err: `JSON parse failed. Raw: "${rawText.slice(0, 150)}"` });
    }

  } catch (err: any) {
    return NextResponse.json({ amount: 0, confidence: 0, _err: `Unexpected: ${err.message}` });
  }
}

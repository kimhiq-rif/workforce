import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Hobby plan: 10s limit. Pro plan: up to 60s. Keep this here for when user upgrades.
export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchExamples(ownerId: string) {
  const { data } = await supabaseAdmin
    .from("receipt_ocr_examples")
    .select("correct_description, correct_amount, correct_merchant, correct_date")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

function buildPrompt(examples: any[]) {
  let examplesText = "";
  if (examples.length > 0) {
    examplesText = "\n\nExamples of receipts from this business that were confirmed correct:\n";
    examples.forEach((ex, i) => {
      examplesText += `Example ${i + 1}: merchant="${ex.correct_merchant ?? "unknown"}", description="${ex.correct_description ?? ""}", amount=${ex.correct_amount}, date="${ex.correct_date ?? "unknown"}"\n`;
    });
  }
  return `You are extracting data from a Thai construction site receipt.${examplesText}

Rules:
- Thai Buddhist Era year (BE): subtract 543 to get CE. Short year "69" = year 2569 BE = 2026 CE. "6/6/69" → 2026-06-06.
- Amount: "3000-" or "3,000" or "฿3000" all mean 3000. Strip commas, ignore "-" suffix.
- Merchant: look for store/company name (not customer name). If it is a generic cash sale form (บิลเงินสด) with no merchant name printed, return null.
- Description: summarize what was purchased in English (max 80 chars).
- confidence: 90 if clearly readable, 70 if some uncertainty, 40 if guessing.

Return ONLY valid JSON, no markdown:
{"merchant":string|null,"description":string,"amount":number,"date":string|null,"confidence":number}`;
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, imageBase64, ownerId } = await req.json();
    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: "imageUrl or imageBase64 required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[OCR] ANTHROPIC_API_KEY is not set");
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    }

    const examples = ownerId ? await fetchExamples(ownerId) : [];

    let imageSource: any;
    if (imageBase64) {
      const sizeKB = Math.round(imageBase64.length * 0.75 / 1024);
      console.log(`[OCR] imageBase64 received, ~${sizeKB}KB`);
      imageSource = { type: "base64", media_type: "image/jpeg", data: imageBase64 };
    } else {
      console.log(`[OCR] fetching imageUrl: ${imageUrl}`);
      const imgFetch = await fetch(imageUrl);
      const imgBuf = await imgFetch.arrayBuffer();
      const b64 = Buffer.from(imgBuf).toString("base64");
      const ct = imgFetch.headers.get("content-type") || "image/jpeg";
      imageSource = { type: "base64", media_type: ct, data: b64 };
    }

    console.log("[OCR] calling Claude claude-haiku-4-5...");
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
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: imageSource },
              { type: "text", text: buildPrompt(examples) },
            ],
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    console.log("[OCR] Claude status:", claudeRes.status, "| type:", claudeData.type, "| error:", claudeData.error?.message ?? "none");

    if (!claudeRes.ok || claudeData.type === "error") {
      console.error("[OCR] Claude error:", JSON.stringify(claudeData.error ?? claudeData));
      return NextResponse.json({ merchant: null, description: "", amount: 0, date: null, confidence: 0, _error: claudeData.error?.message ?? "Claude API error" });
    }

    const rawText = claudeData.content?.[0]?.text ?? "{}";
    console.log("[OCR] Claude raw response:", rawText.slice(0, 200));

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ merchant: null, description: "", amount: 0, date: null, confidence: 0, _error: "no JSON in response" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("[OCR] parsed:", JSON.stringify(parsed));

    return NextResponse.json({
      merchant: parsed.merchant ?? null,
      description: parsed.description ?? "",
      amount: Number(parsed.amount) || 0,
      date: parsed.date ?? null,
      confidence: Number(parsed.confidence) || 0,
    });
  } catch (err: any) {
    console.error("[OCR] exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

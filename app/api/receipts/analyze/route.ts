// Copyright © 2026 Workforce. All rights reserved.
// Analyzes a receipt photo using Claude Vision and returns structured data.
// Falls back gracefully if ANTHROPIC_API_KEY is not set.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAppUserContext } from "@/lib/auth-context";

interface KnownSupplier {
  id: string;
  name_th: string;
  name_en: string;
  category: string | null;
  ocr_fingerprints?: string[] | null;
}

interface AnalyzeResult {
  suggestedSupplierId: string | null;
  suggestedSupplierName: string | null;
  confidence: "high" | "medium" | "low" | "none";
  amount: number | null;
  category: string | null;
  extractedText: string;
  rawSuggestion: string;
}

export async function POST(req: NextRequest) {
  const { profile, ownerId } = await getAppUserContext();
  if (!profile || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { imageUrl, knownSuppliers = [] } = body as { imageUrl: string; knownSuppliers: KnownSupplier[] };

  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful fallback: no OCR available
    return NextResponse.json({
      suggestedSupplierId: null,
      suggestedSupplierName: null,
      confidence: "none",
      amount: null,
      category: null,
      extractedText: "",
      rawSuggestion: "",
    } satisfies AnalyzeResult);
  }

  try {
    const client = new Anthropic({ apiKey });

    // Build supplier list for the prompt — include fingerprints for better matching
    const supplierList = knownSuppliers.length > 0
      ? knownSuppliers
          .map((s, i) => {
            const fingerprints = s.ocr_fingerprints?.length
              ? ` | past_receipt_texts: "${s.ocr_fingerprints.slice(0, 3).join(' | ')}"`
              : "";
            return `${i + 1}. ID="${s.id}" name_th="${s.name_th}" name_en="${s.name_en}" category="${s.category ?? ""}"${fingerprints}`;
          })
          .join("\n")
      : "No suppliers registered yet.";

    const prompt = `You are analyzing a Thai construction business receipt photo.

Known suppliers in the system:
${supplierList}

Instructions:
1. Extract all visible text from the receipt
2. Identify: shop/supplier name, total amount, category (Sand/Stone/Iron/Transport/Tools/Fuel/Concrete/Wood/Electric/Plumbing/Other)
3. Try to match the supplier to one of the known suppliers above (by name similarity, phone, address, or category)
4. Return ONLY valid JSON, no extra text

JSON format:
{
  "extractedText": "all text found in receipt",
  "supplierNameFound": "exact name found on receipt or null",
  "amount": number or null,
  "category": "category string or null",
  "matchedSupplierId": "exact ID from known suppliers list or null",
  "matchedSupplierName": "matched supplier name or null",
  "confidence": "high|medium|low|none",
  "reasoning": "brief explanation"
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response
    let parsed: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON parse failed — return minimal result
    }

    const result: AnalyzeResult = {
      suggestedSupplierId: parsed.matchedSupplierId ?? null,
      suggestedSupplierName: parsed.matchedSupplierName ?? parsed.supplierNameFound ?? null,
      confidence: parsed.confidence ?? "none",
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      category: parsed.category ?? null,
      extractedText: parsed.extractedText ?? rawText,
      rawSuggestion: rawText,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Receipt OCR error:", err);
    return NextResponse.json({
      suggestedSupplierId: null,
      suggestedSupplierName: null,
      confidence: "none",
      amount: null,
      category: null,
      extractedText: "",
      rawSuggestion: "",
    } satisfies AnalyzeResult);
  }
}

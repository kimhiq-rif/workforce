import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { user: authUser } = await getAppUserContext();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType ?? "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `Read all text from this handwritten or printed note.
Return the text exactly as written, preserving line breaks.
First line = event title, remaining lines = notes/details.
Do not add any explanation — return only the raw text.`,
            },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message ?? "Claude API error" },
        { status: 502 }
      );
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text ?? "";
    return NextResponse.json({ text });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unexpected error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSign } from "crypto";

async function getGoogleAccessToken() {
  const keyB64 = process.env.GOOGLE_CLOUD_VISION_KEY;
  if (!keyB64) throw new Error("GOOGLE_CLOUD_VISION_KEY not set");

  const creds = JSON.parse(Buffer.from(keyB64, "base64").toString("utf-8"));
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(creds.private_key, "base64url");
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Token error: " + JSON.stringify(data));
  return data.access_token as string;
}

function parseReceiptText(text: string): { merchantName: string; amount: number; confidence: number } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const merchantName = lines[0] ?? "";

  const totalPattern = /รวม|ยอดรวม|สุทธิ|total|grand\s*total|รวมทั้งสิ้น/i;
  let amount = 0;
  let confidence = 0;

  for (let i = 0; i < lines.length; i++) {
    const combined = lines[i] + " " + (lines[i + 1] ?? "");
    if (totalPattern.test(lines[i])) {
      const nums = combined.match(/[\d,]+\.?\d*/g);
      if (nums) {
        const parsed = nums.map((n) => parseFloat(n.replace(/,/g, ""))).filter((n) => n >= 1);
        if (parsed.length) { amount = Math.max(...parsed); confidence = 85; break; }
      }
    }
  }

  if (amount === 0) {
    const allNums = (text.match(/[\d,]+\.?\d*/g) ?? [])
      .map((n) => parseFloat(n.replace(/,/g, "")))
      .filter((n) => n >= 10 && n <= 1_000_000);
    if (allNums.length) { amount = Math.max(...allNums); confidence = 50; }
  }

  return { merchantName, amount, confidence };
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, imageBase64 } = await req.json();
    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: "imageUrl or imageBase64 required" }, { status: 400 });
    }

    const token = await getGoogleAccessToken();
    const image = imageUrl ? { source: { imageUri: imageUrl } } : { content: imageBase64 };

    const visionRes = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image, features: [{ type: "TEXT_DETECTION", maxResults: 1 }] }],
      }),
    });

    const visionData = await visionRes.json();
    const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text ?? "";

    if (!fullText) return NextResponse.json({ merchantName: "", amount: 0, confidence: 0 });

    return NextResponse.json(parseReceiptText(fullText));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

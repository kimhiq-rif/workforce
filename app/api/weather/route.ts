// Copyright © 2026 Workforce. All rights reserved.
import { NextResponse } from "next/server";

// Koh Phangan, Thailand
const LAT = 9.7317;
const LNG = 100.0136;

export async function GET() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LAT));
  url.searchParams.set("longitude", String(LNG));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weathercode");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", "7");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 500 });
  }
}

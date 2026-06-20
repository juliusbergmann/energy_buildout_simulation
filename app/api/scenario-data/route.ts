import { NextResponse } from "next/server";
import { getAustriaScenarioData } from "@/lib/energy-charts";

export const runtime = "nodejs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? "2025-01-01";
  const end = searchParams.get("end") ?? start;

  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
    return NextResponse.json({ error: "Use YYYY-MM-DD dates for start and end." }, { status: 400 });
  }

  if (new Date(`${start}T00:00:00Z`) > new Date(`${end}T00:00:00Z`)) {
    return NextResponse.json({ error: "Start date must be before or equal to end date." }, { status: 400 });
  }

  try {
    const data = await getAustriaScenarioData(start, end);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Energy-Charts proxy error.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 502 }
    );
  }
}

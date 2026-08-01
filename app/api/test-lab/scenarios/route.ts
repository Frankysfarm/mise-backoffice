import { NextResponse } from "next/server"
import { scenarioCatalog } from "../../../../tests/driver-system-lab/scenarios/catalog"

export const dynamic = "force-dynamic"

function enabled(): boolean {
  return process.env.MISE_TEST_LAB_ENABLED === "true" && process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production"
}

export async function GET() {
  if (!enabled()) return new NextResponse(null, { status: 404 })
  return NextResponse.json({ environment: process.env.MISE_TEST_LAB_ENV ?? "unset", productionSelectable: false, scenarios: scenarioCatalog })
}

export async function POST() {
  // Browser-triggered process execution remains disabled until authenticated,
  // run-owned orchestration and pause/abort leases have executable evidence.
  if (!enabled()) return new NextResponse(null, { status: 404 })
  return NextResponse.json({ error: "Use the guarded test-lab CLI for execution" }, { status: 409 })
}

import { NextResponse } from "next/server"
import { scenarioCatalog } from "../../../../tests/driver-system-lab/scenarios/catalog"
import { assertTestLabEnvironment } from "../../../../tests/driver-system-lab/support/environment"

export const dynamic = "force-dynamic"

function enabled(): boolean {
  try {
    assertTestLabEnvironment()
    return true
  } catch {
    return false
  }
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

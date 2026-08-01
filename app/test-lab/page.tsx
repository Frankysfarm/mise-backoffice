import { notFound } from "next/navigation"
import { TestLabDashboard } from "./test-lab-dashboard"
import { assertTestLabEnvironment } from "../../tests/driver-system-lab/support/environment"

export const dynamic = "force-dynamic"

export default function TestLabPage() {
  try {
    assertTestLabEnvironment()
  } catch {
    notFound()
  }
  return <TestLabDashboard />
}

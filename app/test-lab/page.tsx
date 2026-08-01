import { notFound } from "next/navigation"
import { TestLabDashboard } from "./test-lab-dashboard"

export const dynamic = "force-dynamic"

export default function TestLabPage() {
  if (process.env.MISE_TEST_LAB_ENABLED !== "true" || process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound()
  return <TestLabDashboard />
}

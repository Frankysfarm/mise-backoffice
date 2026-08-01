import { scenarioCatalog } from "../catalog"
import { auditOnlyHandler, ExecutableScenarioRegistry, type ScenarioBindings } from "./registry"

const bindings: ScenarioBindings = new Map(
  scenarioCatalog.map((descriptor) => [
    descriptor.id,
    auditOnlyHandler(`descriptor ${descriptor.id} is bound for deterministic orchestration audit`),
  ]),
)

export const executableScenarioRegistry = new ExecutableScenarioRegistry(scenarioCatalog, bindings)

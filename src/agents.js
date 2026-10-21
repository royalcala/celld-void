import { existsSync } from "node:fs";
import { join } from "node:path";

const DEFINITIONS = [
  {
    id: "claude",
    label: "Claude Code",
    markers: [".claude", "CLAUDE.md"],
    skillPath: [".claude", "skills", "celld-void"],
  },
  {
    id: "commandcode",
    label: "Command Code",
    markers: [".commandcode", "COMMANDCODE.md"],
    skillPath: [".commandcode", "skills", "celld-void"],
  },
  {
    id: "universal",
    label: "Codex/universal",
    markers: [".agents", ".codex", "codex.md"],
    skillPath: [".agents", "skills", "celld-void"],
  },
];

export function detectAgents(root) {
  return DEFINITIONS.filter((definition) =>
    definition.markers.some((marker) => existsSync(join(root, marker))),
  ).map((definition) => ({
    id: definition.id,
    label: definition.label,
    skillPath: join(...definition.skillPath),
  }));
}

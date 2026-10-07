import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// One suite for the whole workspace, with a project per package, agent and
// example, named after its folder. Run it via bin/test; filter with file paths
// or --project <name>.
const folders = (dir: string) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .filter((folder) => fs.existsSync(path.join(folder, "package.json")));

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      ...folders("packages"),
      ...folders("agents"),
      ...folders("examples"),
    ].map((root) => ({
      test: {
        name: path.basename(root),
        root,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["node_modules", "dist"],
      },
    })),
  },
});

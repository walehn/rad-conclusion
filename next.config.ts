import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Build stamp shown in the app footer, fixed when `next build` runs so every
// deploy shows its own date and commit without editing any page.

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as {
    version?: string;
  };
  return pkg.version ?? "";
}

/**
 * Short commit id. Docker builds have no .git (see .dockerignore), so the
 * deploy passes it as the BUILD_COMMIT build arg; local builds ask git.
 * Anything that is not a hex commit id is dropped.
 */
function buildCommit(): string {
  let commit = process.env.BUILD_COMMIT ?? "";
  if (!commit) {
    try {
      commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      commit = "";
    }
  }
  return /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : "";
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: packageVersion(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit(),
  },
};

export default nextConfig;

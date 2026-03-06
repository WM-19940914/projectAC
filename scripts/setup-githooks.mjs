#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    stdio: ["ignore", "pipe", "ignore"],
    ...options,
  });
}

try {
  runGit(["rev-parse", "--git-dir"]);
} catch {
  process.exit(0);
}

const desiredHooksPath = ".githooks";

let currentHooksPath = "";
try {
  currentHooksPath = runGit(["config", "--get", "core.hooksPath"], {
    encoding: "utf8",
  }).toString().trim();
} catch {
  currentHooksPath = "";
}

if (currentHooksPath === desiredHooksPath) {
  process.exit(0);
}

runGit(["config", "core.hooksPath", desiredHooksPath], { stdio: "ignore" });
console.log(`Git hooks path set to ${desiredHooksPath}`);

#!/usr/bin/env node

import { collectUtf8Issues, printUtf8Issues, runGit } from "./lib/utf8-check.mjs";

function listStagedFiles() {
  const out = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB", "-z"]);
  if (!out.length) return [];
  return out
    .toString("utf8")
    .split("\u0000")
    .filter(Boolean);
}

function readStagedBlob(path) {
  return runGit(["show", `:${path}`]);
}

const issues = collectUtf8Issues(listStagedFiles(), readStagedBlob);

if (!printUtf8Issues(issues, "staged files")) {
  process.exit(0);
}

process.exit(1);

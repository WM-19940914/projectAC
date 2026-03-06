#!/usr/bin/env node

import { readdirSync } from "node:fs";
import path from "node:path";
import { collectUtf8Issues, printUtf8Issues, readWorkspaceFile } from "./lib/utf8-check.mjs";

const rootDir = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules"]);

function listWorkspaceFiles(dir = rootDir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      files.push(...listWorkspaceFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

const issues = collectUtf8Issues(listWorkspaceFiles(), readWorkspaceFile);

if (!printUtf8Issues(issues, "workspace files")) {
  process.exit(0);
}

process.exit(1);

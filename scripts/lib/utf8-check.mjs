import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const decoder = new TextDecoder("utf-8", { fatal: true });

const textExtensions = new Set([
  ".bat",
  ".cjs",
  ".cmd",
  ".css",
  ".cts",
  ".editorconfig",
  ".env",
  ".gitattributes",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".ps1",
  ".scss",
  ".sh",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const textBasenames = new Set([
  ".env",
  ".env.development",
  ".env.example",
  ".env.local",
  ".env.production",
  ".env.test",
  "Dockerfile",
]);

export function runGit(args) {
  return execFileSync("git", args, { encoding: "buffer" });
}

export function isBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

export function hasUtf8Bom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function isTextPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const basename = path.posix.basename(normalized);

  if (textBasenames.has(basename)) return true;
  if (basename.startsWith(".env.")) return true;
  if (normalized.startsWith(".githooks/")) return true;

  return textExtensions.has(path.posix.extname(normalized).toLowerCase());
}

export function collectUtf8Issues(files, readFile) {
  const invalid = [];
  const withBom = [];

  for (const file of files) {
    if (!isTextPath(file)) continue;

    let buf;
    try {
      buf = readFile(file);
    } catch {
      continue;
    }

    if (!buf.length || isBinary(buf)) continue;

    try {
      decoder.decode(buf);
    } catch {
      invalid.push(file);
      continue;
    }

    if (hasUtf8Bom(buf)) {
      withBom.push(file);
    }
  }

  return { invalid, withBom };
}

export function readWorkspaceFile(filePath) {
  return readFileSync(filePath);
}

export function printUtf8Issues({ invalid, withBom }, scopeLabel) {
  if (!invalid.length && !withBom.length) {
    return false;
  }

  console.error(`ERROR: UTF-8 검사 실패 (${scopeLabel}). 아래 파일을 수정 후 다시 시도하세요.`);

  if (invalid.length) {
    console.error("\n[UTF-8 아님]");
    for (const file of invalid) {
      console.error(`- ${file}`);
    }
  }

  if (withBom.length) {
    console.error("\n[UTF-8 BOM 포함]");
    for (const file of withBom) {
      console.error(`- ${file}`);
    }
  }

  return true;
}

#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const decoder = new TextDecoder("utf-8", { fatal: true });

function runGit(args) {
  return execFileSync("git", args, { encoding: "buffer" });
}

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

function isBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

function hasUtf8Bom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

const files = listStagedFiles();
const invalid = [];
const withBom = [];

for (const file of files) {
  let buf;
  try {
    buf = readStagedBlob(file);
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

if (!invalid.length && !withBom.length) {
  process.exit(0);
}

console.error("ERROR: UTF-8 검사 실패. 아래 파일을 수정 후 다시 커밋하세요.");

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

process.exit(1);

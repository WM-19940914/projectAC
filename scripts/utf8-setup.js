#!/usr/bin/env node
/**
 * Apply UTF-8-oriented environment defaults for ad-hoc Node.js scripts.
 */

process.env.LANG = "ko_KR.UTF-8";
process.env.LC_ALL = "ko_KR.UTF-8";
process.env.PYTHONUTF8 = "1";
process.env.PYTHONIOENCODING = "utf-8";

if (process.stdin.setEncoding) {
  process.stdin.setEncoding("utf8");
}

console.log("UTF-8 environment defaults applied.");

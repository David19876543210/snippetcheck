import type { Snippet, SkippedSnippet, SnippetLang } from "./types.js";

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;

const SKIP_TOKENS = ["snippetcheck-skip", "no-test", "notest", "skip-test", "nocompile"];
const SKIP_COMMENT_RE = /<!--\s*snippetcheck:\s*skip\s*-->/i;

const LANG_MAP: Record<string, SnippetLang> = {
  ts: "ts",
  typescript: "ts",
  mts: "ts",
  cts: "ts",
  tsx: "tsx",
  js: "js",
  javascript: "js",
  mjs: "js",
  cjs: "js",
  jsx: "jsx",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isClosingFence(line: string, fenceChar: string, fenceLen: number): boolean {
  const trimmed = line.trimStart();
  const re = new RegExp(`^${escapeRegExp(fenceChar)}{${fenceLen},}\\s*$`);
  return re.test(trimmed);
}

function stripIndent(line: string, indent: string): string {
  if (indent.length === 0) return line;
  let i = 0;
  while (i < indent.length && i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  return line.slice(i);
}

function mapLang(token: string): SnippetLang | null {
  return LANG_MAP[token.toLowerCase()] ?? null;
}

function hasSkipToken(infoRaw: string): boolean {
  const lower = infoRaw.toLowerCase();
  return SKIP_TOKENS.some((t) => lower.includes(t));
}

function precedingLinesHaveSkipComment(lines: string[], fenceLineIndex: number): boolean {
  const start = Math.max(0, fenceLineIndex - 3);
  for (let k = start; k < fenceLineIndex; k++) {
    if (SKIP_COMMENT_RE.test(lines[k])) return true;
  }
  return false;
}

function makeId(source: string, line: number, index: number): string {
  const base = source.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "doc";
  return `${base}-L${line}-${index}`;
}

const IMPORT_PATTERNS: RegExp[] = [
  // import type { A, B } from "pkg"
  /\bimport\s+type\s+\{[^}]*\}\s*from\s*["']([^"']+)["']/g,
  // import Default, { A, B } from "pkg"  |  import { A, B } from "pkg"
  /\bimport\s+(?:\w+\s*,\s*)?\{[^}]*\}\s*from\s*["']([^"']+)["']/g,
  // import * as ns from "pkg"
  /\bimport\s+\*\s+as\s+\w+\s+from\s*["']([^"']+)["']/g,
  // import type Default from "pkg"
  /\bimport\s+type\s+\w+\s+from\s*["']([^"']+)["']/g,
  // import Default from "pkg"
  /\bimport\s+\w+\s+from\s*["']([^"']+)["']/g,
  // import "pkg" (side-effect only)
  /\bimport\s*["']([^"']+)["']/g,
  // export type { A } from "pkg"
  /\bexport\s+type\s+\{[^}]*\}\s*from\s*["']([^"']+)["']/g,
  // export { A } from "pkg"
  /\bexport\s+\{[^}]*\}\s*from\s*["']([^"']+)["']/g,
  // require("pkg")
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  // dynamic import("pkg")
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
];

export function findImports(code: string): string[] {
  const specifiers = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  return Array.from(specifiers);
}

export function importMatchesPackage(specifier: string, pkg: string): boolean {
  return specifier === pkg || specifier.startsWith(pkg + "/");
}

export interface ExtractResult {
  snippets: Snippet[];
  skipped: SkippedSnippet[];
}

export function extractSnippets(text: string, source: string): ExtractResult {
  const rawLines = text.split(/\r\n|\r|\n/);
  const snippets: Snippet[] = [];
  const skipped: SkippedSnippet[] = [];

  let i = 0;
  let blockIndex = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const m = FENCE_RE.exec(line);
    if (!m) {
      i++;
      continue;
    }

    const indent = m[1];
    const fenceChar = m[2][0];
    const fenceLen = m[2].length;
    const infoRaw = m[3];
    const openLineIndex = i;

    let closeIndex = -1;
    for (let j = i + 1; j < rawLines.length; j++) {
      if (isClosingFence(rawLines[j], fenceChar, fenceLen)) {
        closeIndex = j;
        break;
      }
    }

    const bodyEnd = closeIndex === -1 ? rawLines.length : closeIndex;
    const bodyLines = rawLines.slice(i + 1, bodyEnd).map((l) => stripIndent(l, indent));

    i = closeIndex === -1 ? rawLines.length : closeIndex + 1;

    const infoTrimmed = infoRaw.trim();
    const firstTokenMatch = infoTrimmed.match(/^[^\s{]+/);
    const firstToken = firstTokenMatch ? firstTokenMatch[0] : "";
    const lang = mapLang(firstToken);

    if (!lang) continue; // unrecognized/missing language: ignored entirely, not counted

    blockIndex++;
    const codeLine = openLineIndex + 2; // 1-based: fence line + 1
    const code = bodyLines.join("\n");
    const id = makeId(source, codeLine, blockIndex);

    const snippet: Snippet = {
      id,
      source,
      line: codeLine,
      lang,
      code,
      imports: findImports(code),
    };

    const explicitSkip = hasSkipToken(infoRaw) || precedingLinesHaveSkipComment(rawLines, openLineIndex);

    if (explicitSkip) {
      skipped.push({ snippet, reason: "explicitly-skipped" });
      continue;
    }

    snippets.push(snippet);
  }

  return { snippets, skipped };
}

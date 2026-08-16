import ts from "typescript";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { importMatchesPackage } from "./extract.js";
import type { Finding, FindingKind, Snippet, SkippedSnippet, SnippetLang } from "./types.js";

export interface CheckOptions {
  packageName: string;
  workspaceRoot: string;
  includeJs: boolean;
}

export interface CheckSnippetsResult {
  findings: Finding[];
  skipped: SkippedSnippet[];
  checked: number;
}

/**
 * Diagnostic codes we trust, mapped to the Finding kind they represent.
 * Every other TypeScript diagnostic code is discarded, no matter how it looks —
 * only these have a message shape precise enough to trace back to the target
 * package's own declarations (see resolveOrigin).
 */
const KIND_BY_CODE: Record<number, FindingKind> = {
  2305: "removed-export",
  2724: "renamed-export",
  2339: "removed-property",
  2551: "renamed-property",
  2353: "unknown-option",
  2561: "unknown-option",
  2554: "wrong-arity",
};

const UNRESOLVED_IMPORT_CODE = 2307;

export function checkSnippets(snippets: Snippet[], options: CheckOptions): CheckSnippetsResult {
  const skipped: SkippedSnippet[] = [];
  const candidates: Snippet[] = [];

  for (const snippet of snippets) {
    if ((snippet.lang === "js" || snippet.lang === "jsx") && !options.includeJs) {
      skipped.push({ snippet, reason: "unsupported-language" });
      continue;
    }
    const importsTarget = snippet.imports.some((spec) => importMatchesPackage(spec, options.packageName));
    if (!importsTarget) {
      skipped.push({ snippet, reason: "no-target-import" });
      continue;
    }
    candidates.push(snippet);
  }

  if (candidates.length === 0) {
    return { findings: [], skipped, checked: 0 };
  }

  const snippetsDir = join(options.workspaceRoot, "snippets");
  mkdirSync(snippetsDir, { recursive: true });

  const filePathToSnippet = new Map<string, Snippet>();
  const filePaths: string[] = [];

  for (const snippet of candidates) {
    const filePath = join(snippetsDir, `${snippet.id}.${extensionFor(snippet.lang)}`);
    writeFileSync(filePath, snippet.code, "utf8");
    filePathToSnippet.set(filePath, snippet);
    filePaths.push(filePath);
  }

  const compilerOptions: ts.CompilerOptions = {
    noEmit: true,
    skipLibCheck: true,
    strict: false,
    noImplicitAny: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    checkJs: options.includeJs,
    types: [],
    baseUrl: options.workspaceRoot,
  };

  const program = ts.createProgram(filePaths, compilerOptions);
  const checker = program.getTypeChecker();

  const findings: Finding[] = [];
  let checked = 0;

  for (const filePath of filePaths) {
    const snippet = filePathToSnippet.get(filePath)!;
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      skipped.push({ snippet, reason: "unparseable" });
      continue;
    }

    const syntactic = program.getSyntacticDiagnostics(sourceFile);
    if (syntactic.length > 0) {
      skipped.push({ snippet, reason: "unparseable" });
      continue;
    }

    const semantic = program.getSemanticDiagnostics(sourceFile);
    const hasUnresolvedImport = semantic.some((d) => d.code === UNRESOLVED_IMPORT_CODE);
    if (hasUnresolvedImport) {
      skipped.push({ snippet, reason: "unresolved-import" });
      continue;
    }

    checked++;

    for (const diagnostic of semantic) {
      const finding = toFinding(diagnostic, sourceFile, snippet, checker, options.packageName);
      if (finding) findings.push(finding);
    }
  }

  return { findings, skipped, checked };
}

function extensionFor(lang: SnippetLang): string {
  return lang;
}

function toFinding(
  diagnostic: ts.Diagnostic,
  sourceFile: ts.SourceFile,
  snippet: Snippet,
  checker: ts.TypeChecker,
  packageName: string,
): Finding | null {
  const kind = KIND_BY_CODE[diagnostic.code];
  if (!kind) return null;
  if (diagnostic.start === undefined) return null;

  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");

  if (!resolveOrigin(diagnostic, sourceFile, checker, packageName, message)) {
    // Cannot trace this diagnostic back to the target package's own declarations.
    // Never guess: drop it silently rather than risk a false positive.
    return null;
  }

  const { symbol, suggestion } = extractSymbolAndSuggestion(diagnostic.code, message);
  const { line: lineIdx, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
  const codeLines = snippet.code.split("\n");
  const excerpt = (codeLines[lineIdx] ?? "").trim();

  return {
    kind,
    symbol,
    code: diagnostic.code,
    message,
    suggestion,
    source: snippet.source,
    line: snippet.line + lineIdx,
    column: character + 1,
    excerpt,
    snippetId: snippet.id,
    section: snippet.sectionPath.length > 0 ? snippet.sectionPath[snippet.sectionPath.length - 1] : null,
    sectionPath: snippet.sectionPath,
  };
}

function resolveOrigin(
  diagnostic: ts.Diagnostic,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  packageName: string,
  message: string,
): boolean {
  if (diagnostic.code === 2305 || diagnostic.code === 2724) {
    const parsed = parseModuleNoExportedMember(message);
    if (!parsed) return false;
    return importMatchesPackage(parsed.moduleSpecifier, packageName);
  }

  const node = findNodeAtPosition(sourceFile, diagnostic.start!);
  if (!node) return false;

  let declFile: string | null = null;
  if (diagnostic.code === 2339 || diagnostic.code === 2551) {
    declFile = resolvePropertyAccessOrigin(node, checker);
  } else if (diagnostic.code === 2353 || diagnostic.code === 2561) {
    declFile = resolveObjectLiteralOrigin(node, checker);
  } else if (diagnostic.code === 2554) {
    declFile = resolveCallArityOrigin(node, checker);
  }

  return declFile !== null && isFromTargetPackage(declFile, packageName);
}

function findNodeAtPosition(sourceFile: ts.SourceFile, pos: number): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (pos >= node.getStart(sourceFile) && pos < node.getEnd()) {
      return ts.forEachChild(node, find) ?? node;
    }
    return undefined;
  }
  return find(sourceFile);
}

function resolvePropertyAccessOrigin(node: ts.Node, checker: ts.TypeChecker): string | null {
  let n: ts.Node | undefined = node;
  while (n && !ts.isPropertyAccessExpression(n)) n = n.parent;
  if (!n) return null;
  const type = checker.getTypeAtLocation(n.expression);
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  const decl = symbol?.declarations?.[0];
  if (!decl) return null;
  return decl.getSourceFile().fileName;
}

function resolveObjectLiteralOrigin(node: ts.Node, checker: ts.TypeChecker): string | null {
  let n: ts.Node | undefined = node;
  while (n && !ts.isObjectLiteralExpression(n)) n = n.parent;
  if (!n) return null;
  const contextualType = checker.getContextualType(n);
  const symbol = contextualType?.getSymbol() ?? contextualType?.aliasSymbol;
  const decl = symbol?.declarations?.[0];
  if (!decl) return null;
  return decl.getSourceFile().fileName;
}

function resolveCallArityOrigin(node: ts.Node, checker: ts.TypeChecker): string | null {
  let n: ts.Node | undefined = node;
  while (n && !ts.isCallExpression(n)) n = n.parent;
  if (!n) return null;
  const type = checker.getTypeAtLocation(n.expression);
  const signatures = type.getCallSignatures();
  const decl = signatures[0]?.declaration;
  if (!decl) return null;
  return decl.getSourceFile().fileName;
}

function isFromTargetPackage(filePath: string, packageName: string): boolean {
  const normalized = filePath.split(sep).join("/");
  return normalized.includes(`node_modules/${packageName}/`);
}

function parseModuleNoExportedMember(
  message: string,
): { moduleSpecifier: string; symbol: string; suggestion: string | null } | null {
  const re =
    /Module ['"]+(.+?)['"]+ has no exported member(?: named)? ['"](.+?)['"]\.(?:\s*Did you mean ['"](.+?)['"]\?)?/;
  const m = re.exec(message);
  if (!m) return null;
  return { moduleSpecifier: m[1], symbol: m[2], suggestion: m[3] ?? null };
}

function extractSymbolAndSuggestion(
  code: number,
  message: string,
): { symbol: string | null; suggestion: string | null } {
  switch (code) {
    case 2305:
    case 2724: {
      const parsed = parseModuleNoExportedMember(message);
      return { symbol: parsed?.symbol ?? null, suggestion: parsed?.suggestion ?? null };
    }
    case 2339: {
      const m = /Property ['"](.+?)['"] does not exist on type/.exec(message);
      return { symbol: m?.[1] ?? null, suggestion: null };
    }
    case 2551: {
      const m = /Property ['"](.+?)['"] does not exist on type ['"].+?['"]\.\s*Did you mean ['"](.+?)['"]\?/.exec(
        message,
      );
      return { symbol: m?.[1] ?? null, suggestion: m?.[2] ?? null };
    }
    case 2353: {
      const m = /and ['"](.+?)['"] does not exist in type/.exec(message);
      return { symbol: m?.[1] ?? null, suggestion: null };
    }
    case 2561: {
      const m = /but ['"](.+?)['"] does not exist in type ['"].+?['"]\.\s*Did you mean ['"](.+?)['"]\?/.exec(
        message,
      );
      return { symbol: m?.[1] ?? null, suggestion: m?.[2] ?? null };
    }
    case 2554:
      return { symbol: null, suggestion: null };
    default:
      return { symbol: null, suggestion: null };
  }
}

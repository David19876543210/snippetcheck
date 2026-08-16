import ts from "typescript";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { importMatchesPackage } from "./extract.js";
import type { Finding, FindingKind, RawDiagnostic, Snippet, SkippedSnippet, SnippetLang } from "./types.js";

export interface CheckOptions {
  packageName: string;
  workspaceRoot: string;
  includeJs: boolean;
  /** Collect every semantic diagnostic outside KIND_BY_CODE for discovery. See
   *  CheckSnippetsResult.unfiltered and types.ts's CheckResult.unfilteredDiagnostics. */
  unfiltered?: boolean;
}

export interface CheckSnippetsResult {
  findings: Finding[];
  skipped: SkippedSnippet[];
  checked: number;
  unfiltered: RawDiagnostic[];
}

/**
 * Diagnostic codes we trust, mapped to the Finding kind they represent.
 * Every other TypeScript diagnostic code is discarded, no matter how it looks —
 * only these have a message shape precise enough to trace back to the target
 * package's own declarations (see resolveOrigin).
 *
 * TS2614 and TS1192 are mirror images of each other, both classed as
 * wrong-import-form rather than removed-export/renamed-export: the exported thing
 * still exists, the snippet is just importing it in the wrong form.
 *   - TS2614: `import { x } from "pkg"` where pkg has no named export `x`, but does
 *     have a default export (e.g. `export default z` in zod). Its "Did you mean to
 *     use ... instead?" clause always echoes the same failed name in default-import
 *     syntax, never a different symbol, so it carries no rename suggestion.
 *   - TS1192: `import x from "pkg"` where pkg has no default export at all — the
 *     reverse mistake.
 * TS2614 shares 2305/2724's "Module 'x' has no exported member 'y'" shape and the
 * same moduleSpecifier-based origin gate. TS1192's message quotes the *resolved*
 * absolute file path, not the source specifier, so it needs its own path-based
 * origin gate (see parseNoDefaultExport) — and, like every other code's message,
 * that raw path never reaches a rendered Finding: sanitizeMessage strips it below.
 */
const KIND_BY_CODE: Record<number, FindingKind> = {
  2305: "removed-export",
  2724: "renamed-export",
  2614: "wrong-import-form",
  1192: "wrong-import-form",
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
    return { findings: [], skipped, checked: 0, unfiltered: [] };
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
  const unfiltered: RawDiagnostic[] = [];
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
    // Skip only when the TARGET package's own import can't resolve. A snippet that
    // also imports some other, uninstalled third-party package still resolves that
    // import to `any` under strict:false/noImplicitAny:false, which cannot itself
    // produce a false diagnostic on a target-package symbol — so it's still checkable.
    const unresolvedTargetImport = semantic.some((d) => {
      if (d.code !== UNRESOLVED_IMPORT_CODE) return false;
      const mod = parseUnresolvedModule(ts.flattenDiagnosticMessageText(d.messageText, " "));
      return mod !== null && importMatchesPackage(mod, options.packageName);
    });
    if (unresolvedTargetImport) {
      skipped.push({ snippet, reason: "unresolved-import" });
      continue;
    }

    checked++;

    for (const diagnostic of semantic) {
      const finding = toFinding(diagnostic, sourceFile, snippet, checker, options.packageName, options.workspaceRoot);
      if (finding) findings.push(finding);
      else if (
        options.unfiltered &&
        !KIND_BY_CODE[diagnostic.code] &&
        diagnostic.code !== UNRESOLVED_IMPORT_CODE &&
        diagnostic.start !== undefined
      ) {
        const { line: lineIdx } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
        unfiltered.push({
          code: diagnostic.code,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
          source: snippet.source,
          line: snippet.line + lineIdx,
        });
      }
    }
  }

  return { findings, skipped, checked, unfiltered };
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
  workspaceRoot: string,
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

  // TS1192 quotes a resolved temp-workspace path outright, and anonymous/inferred
  // type names (e.g. `typeof import("/private/.../node_modules/pkg/index")`) can
  // drag one into 2339/2353 messages too. Sanitize every text field on the way out,
  // and if a path survives sanitizing anyway, drop the finding rather than mail a
  // stranger their own machine's temp directory layout — same reasoning as the
  // origin gate: a wrong/leaky report is worse than a missed one.
  const writtenSpecifier = snippet.imports.find((spec) => importMatchesPackage(spec, packageName)) ?? packageName;
  const sanitizedMessage = sanitizeText(message, workspaceRoot, writtenSpecifier);
  const sanitizedSymbol = symbol === null ? null : sanitizeText(symbol, workspaceRoot, writtenSpecifier);
  const sanitizedSuggestion = suggestion === null ? null : sanitizeText(suggestion, workspaceRoot, writtenSpecifier);
  if (
    containsUnsanitizedPath(sanitizedMessage) ||
    (sanitizedSymbol !== null && containsUnsanitizedPath(sanitizedSymbol)) ||
    (sanitizedSuggestion !== null && containsUnsanitizedPath(sanitizedSuggestion))
  ) {
    return null;
  }

  const { line: lineIdx, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
  const codeLines = snippet.code.split("\n");
  const excerpt = (codeLines[lineIdx] ?? "").trim();

  return {
    kind,
    symbol: sanitizedSymbol,
    code: diagnostic.code,
    message: sanitizedMessage,
    typescriptSuggestion: sanitizedSuggestion,
    source: snippet.source,
    line: snippet.line + lineIdx,
    column: character + 1,
    excerpt,
    snippetId: snippet.id,
    section: snippet.sectionPath.length > 0 ? snippet.sectionPath[snippet.sectionPath.length - 1] : null,
    sectionPath: snippet.sectionPath,
  };
}

/**
 * Strips the CLI's own temp-workspace machinery out of a diagnostic's text, in two
 * passes:
 *   1. Collapse any `node_modules/<pkg>/<rest>` segment — scoped or not, wherever it
 *      appears, not just for the target package — to `<pkg>/<rest>`, dropping a
 *      trailing resolved `/index` (TypeScript's module-identity suffix; source text
 *      never spells this out).
 *   2. Anything still carrying the raw temp workspace root — inside or outside
 *      node_modules — becomes the package specifier exactly as the snippet wrote it.
 * containsUnsanitizedPath is the backstop: if a path-shaped string still comes out
 * the other side, the caller drops the finding instead of rendering it.
 */
function sanitizeText(text: string, workspaceRoot: string, writtenSpecifier: string): string {
  let out = text.replace(
    /(?:[^\s'"()]*\/)?node_modules\/(@[^\s'"()/]+\/[^\s'"()/]+|[^\s'"()/]+)((?:\/[^\s'"()]*)?)/g,
    (_match, pkg: string, rest: string) => {
      const cleanedRest = rest.replace(/\/index(?:\.d\.ts|\.ts)?$/, "");
      return cleanedRest ? `${pkg}${cleanedRest}` : pkg;
    },
  );
  if (workspaceRoot) {
    out = out.split(workspaceRoot).join(writtenSpecifier);
  }
  return out;
}

function containsUnsanitizedPath(text: string): boolean {
  return text.includes("node_modules") || /^\//.test(text) || /^[A-Za-z]:\\/.test(text);
}

function resolveOrigin(
  diagnostic: ts.Diagnostic,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  packageName: string,
  message: string,
): boolean {
  if (diagnostic.code === 2305 || diagnostic.code === 2724 || diagnostic.code === 2614) {
    const parsed = parseModuleNoExportedMember(message);
    if (!parsed) return false;
    return importMatchesPackage(parsed.moduleSpecifier, packageName);
  }

  if (diagnostic.code === 1192) {
    const parsed = parseNoDefaultExport(message);
    if (!parsed) return false;
    return isFromTargetPackage(parsed.resolvedPath, packageName);
  }

  const node = findNodeAtPosition(sourceFile, diagnostic.start!);
  if (!node) return false;

  let declFiles: string[] = [];
  if (diagnostic.code === 2339 || diagnostic.code === 2551) {
    declFiles = resolvePropertyAccessOrigin(node, checker);
  } else if (diagnostic.code === 2353 || diagnostic.code === 2561) {
    declFiles = resolveObjectLiteralOrigin(node, checker);
  } else if (diagnostic.code === 2554) {
    const declFile = resolveCallArityOrigin(node, checker);
    declFiles = declFile ? [declFile] : [];
  }

  return declFiles.some((f) => isFromTargetPackage(f, packageName));
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

/**
 * A type's own symbol/aliasSymbol is undefined for intersection types (e.g.
 * `Chalk & ChalkFunction & { ... }`, the inferred type of a CJS `export =` default
 * import merged with its call signature) — TS doesn't give an intersection one
 * canonical symbol. Recurse into its constituents so a target-package member is
 * still traceable; each candidate still has to pass isFromTargetPackage, so this
 * only widens what counts as traceable, never what counts as a match.
 */
function declarationOriginFiles(type: ts.Type): string[] {
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  if (symbol?.declarations && symbol.declarations.length > 0) {
    return symbol.declarations.map((d) => d.getSourceFile().fileName);
  }
  if (type.isIntersection()) {
    return type.types.flatMap((t) => declarationOriginFiles(t));
  }
  return [];
}

function resolvePropertyAccessOrigin(node: ts.Node, checker: ts.TypeChecker): string[] {
  let n: ts.Node | undefined = node;
  while (n && !ts.isPropertyAccessExpression(n)) n = n.parent;
  if (!n) return [];
  const type = checker.getTypeAtLocation(n.expression);
  return declarationOriginFiles(type);
}

function resolveObjectLiteralOrigin(node: ts.Node, checker: ts.TypeChecker): string[] {
  let n: ts.Node | undefined = node;
  while (n && !ts.isObjectLiteralExpression(n)) n = n.parent;
  if (!n) return [];
  const contextualType = checker.getContextualType(n);
  if (!contextualType) return [];
  return declarationOriginFiles(contextualType);
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

function parseUnresolvedModule(message: string): string | null {
  const m = /Cannot find module ['"](.+?)['"]/.exec(message);
  return m ? m[1] : null;
}

function parseNoDefaultExport(message: string): { resolvedPath: string } | null {
  // Unlike TS2305/2724/2614, which quote the specifier text as written in the
  // snippet ("zod"), TS1192 quotes the *resolved* absolute file path TypeScript
  // followed to get there — there is no default-import equivalent of "the source
  // text said 'zod'" once resolution already happened. sanitizeMessage (below)
  // is what keeps that path out of anything actually rendered.
  const m = /Module ['"]+(.+?)['"]+ has no default export\.?/.exec(message);
  return m ? { resolvedPath: m[1] } : null;
}

function parseModuleNoExportedMember(
  message: string,
): { moduleSpecifier: string; symbol: string; suggestion: string | null } | null {
  // TS2305 and TS2614 are prefixed with "Module "; TS2724 is not ("'"ai"' has no
  // exported member named 'X'. Did you mean 'Y'?"). All three wrap the module
  // specifier the same way. TS2614's trailing clause ("Did you mean to use 'import X
  // from "mod"' instead?") never matches the "Did you mean 'Y'?" group below — it
  // always echoes the same failed name in default-import syntax, not an alternate
  // name — so it correctly falls through to a null suggestion, same as TS2305.
  const re =
    /(?:Module\s+)?['"]+(.+?)['"]+ has no exported member(?: named)? ['"](.+?)['"]\.(?:\s*Did you mean ['"](.+?)['"]\?)?/;
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
    case 2724:
    case 2614: {
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
      // Unlike 2551's "Did you mean 'x'?", TS2561's real message reads
      // "Did you mean to write 'x'?" — a different phrase, not just a different code.
      const m =
        /but ['"](.+?)['"] does not exist in type ['"].+?['"]\.\s*Did you mean to write ['"](.+?)['"]\?/.exec(
          message,
        );
      return { symbol: m?.[1] ?? null, suggestion: m?.[2] ?? null };
    }
    case 2554:
    case 1192:
      // Neither names a specific missing symbol: 2554 is an arity mismatch, 1192 is
      // "this whole module has no default export" — the failure is about the import
      // form itself, not a name.
      return { symbol: null, suggestion: null };
    default:
      return { symbol: null, suggestion: null };
  }
}

export type SnippetLang = "ts" | "tsx" | "js" | "jsx";

export interface Snippet {
  id: string;
  source: string;
  line: number;
  lang: SnippetLang;
  code: string;
  imports: string[];
  sectionPath: string[];
}

// The array is the source of truth; the type is derived from it, so the two can
// never drift apart. report.ts derives its column widths from this same array —
// see SKIP_REASON_COLUMN_WIDTH — so a new member can never silently break
// alignment the way "unsupported-language" (exactly 20 chars) once did.
export const SKIP_REASONS = [
  "no-target-import",
  "unparseable",
  "explicitly-skipped",
  "unresolved-import",
  "unsupported-language",
  "historical-section",
  "before-example",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export interface SkippedSnippet {
  snippet: Snippet;
  reason: SkipReason;
}

export const FINDING_KINDS = [
  "removed-export",
  "renamed-export",
  "removed-property",
  "renamed-property",
  "unknown-option",
  "wrong-arity",
  "wrong-import-form",
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export interface Finding {
  kind: FindingKind;
  symbol: string | null;
  code: number;
  message: string;
  /**
   * TypeScript's own "Did you mean 'x'?" guess, based on string similarity — not a
   * verified migration target. Never render this as if it were snippetcheck's advice.
   */
  typescriptSuggestion: string | null;
  source: string;
  line: number;
  column: number;
  excerpt: string;
  snippetId: string;
  section: string | null;
  sectionPath: string[];
}

export interface CheckResult {
  packageName: string;
  packageVersion: string;
  documentsScanned: number;
  snippetsFound: number;
  /** The true denominator: how many snippets were eligible for checking before
   *  --max-snippets sampling truncated the pool. Equal to snippetsChecked plus
   *  every check-time skip reason when no sampling occurred. */
  snippetsTotal: number;
  snippetsChecked: number;
  skipped: SkippedSnippet[];
  findings: Finding[];
  /**
   * True when the resolved package ships no discoverable type declarations at all —
   * no `types`/`typings` field, no exports-map `types` condition, no bundled
   * `index.d.ts`. Every snippet is then checked as untyped `any` under
   * noImplicitAny:false, so zero findings in that case means "nothing was ever
   * measured," not "the docs are clean." Always render this as its own status —
   * never fold it into an empty findings array.
   */
  noTypeDeclarations: boolean;
  /**
   * Only meaningful when noTypeDeclarations is true: whether a DefinitelyTyped
   * `@types/<pkg>` package exists on the registry. snippetcheck never auto-installs
   * it — this is purely informative context for why nothing was found.
   */
  definitelyTypedAvailable: boolean;
  /**
   * Only populated when --unfiltered is passed. Every semantic diagnostic TypeScript
   * raised on a snippet that imports the target package, whose code is NOT in
   * check.ts's KIND_BY_CODE allowlist — i.e. exactly the class of message the CLI
   * currently discards. This is a discovery tool for finding the allowlist's next
   * candidate code, not a source of findings: nothing here has passed the origin
   * gate, and none of it is precision-checked. Absent (not just empty) when the flag
   * wasn't passed, so JSON consumers can tell "didn't look" from "looked, found none".
   */
  unfilteredDiagnostics?: RawDiagnostic[];
}

export interface RawDiagnostic {
  code: number;
  message: string;
  source: string;
  line: number;
}

import { mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const INSTALL_TIMEOUT_MS = 180_000;
const REGISTRY_LOOKUP_TIMEOUT_MS = 15_000;

export interface PackageSpec {
  name: string;
  range: string;
}

export interface Workspace {
  root: string;
  packageName: string;
  packageVersion: string;
  /** False when the resolved package ships no discoverable type declarations at
   *  all — see detectTypeDeclarations. */
  hasTypeDeclarations: boolean;
  /** Only meaningful when hasTypeDeclarations is false: whether `@types/<pkg>`
   *  exists on the registry. snippetcheck never auto-installs it — purely
   *  informative, to distinguish "untyped, but typeable" from "nobody has typed this". */
  definitelyTypedAvailable: boolean;
  dispose: () => Promise<void>;
}

/** Splits on the LAST "@" so scoped package names survive. No "@" after position 0 means "latest". */
export function parsePackageSpec(spec: string): PackageSpec {
  const lastAt = spec.lastIndexOf("@");
  if (lastAt <= 0) {
    return { name: spec, range: "latest" };
  }
  return { name: spec.slice(0, lastAt), range: spec.slice(lastAt + 1) };
}

export async function createWorkspace(spec: string): Promise<Workspace> {
  const { name, range } = parsePackageSpec(spec);
  const root = await mkdtemp(join(tmpdir(), "snippetcheck-"));

  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        { name: "snippetcheck-workspace", private: true, type: "module", version: "0.0.0" },
        null,
        2,
      ),
    );

    await execFileAsync(
      "npm",
      ["install", `${name}@${range}`, "--no-audit", "--no-fund", "--no-package-lock", "--loglevel=error"],
      { cwd: root, timeout: INSTALL_TIMEOUT_MS },
    );

    const pkgDir = join(root, "node_modules", ...name.split("/"));
    const installedPkgJsonPath = join(pkgDir, "package.json");
    const installedRaw = await readFile(installedPkgJsonPath, "utf8");
    const installedPkgJson = JSON.parse(installedRaw) as InstalledPackageJson;
    const packageVersion = installedPkgJson.version ?? range;

    const { hasTypeDeclarations, definitelyTypedAvailable } = await detectTypeDeclarations(
      pkgDir,
      name,
      installedPkgJson,
    );

    const dispose = async () => {
      await rm(root, { recursive: true, force: true });
    };

    return { root, packageName: name, packageVersion, hasTypeDeclarations, definitelyTypedAvailable, dispose };
  } catch (err) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

interface InstalledPackageJson {
  version?: string;
  main?: string;
  types?: string;
  typings?: string;
  exports?: unknown;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** The "." entry's "types" condition, for packages that declare types only via the
 *  modern exports map (no top-level `types`/`typings` field). Handles both the
 *  single-entry-point shape (`exports: { types: ..., default: ... }`) and the
 *  subpath-map shape (`exports: { ".": { types: ..., default: ... }, ... }`). */
function exportsTypesCondition(exportsField: unknown): boolean {
  if (!exportsField || typeof exportsField !== "object") return false;
  const obj = exportsField as Record<string, unknown>;
  const dotEntry = "." in obj ? obj["."] : obj;
  return Boolean(dotEntry && typeof dotEntry === "object" && typeof (dotEntry as Record<string, unknown>).types === "string");
}

/** Best-effort, no-install registry lookup for `@types/<pkg>` — informative only,
 *  never used to alter what gets checked. Any failure (404, network) just means "no". */
async function definitelyTypedExists(packageName: string): Promise<boolean> {
  const dtName = packageName.startsWith("@")
    ? `@types/${packageName.slice(1).replace("/", "__")}`
    : `@types/${packageName}`;
  try {
    await execFileAsync("npm", ["view", dtName, "version", "--loglevel=error"], {
      timeout: REGISTRY_LOOKUP_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

async function detectTypeDeclarations(
  pkgDir: string,
  packageName: string,
  pkgJson: InstalledPackageJson,
): Promise<{ hasTypeDeclarations: boolean; definitelyTypedAvailable: boolean }> {
  if (typeof pkgJson.types === "string" || typeof pkgJson.typings === "string") {
    return { hasTypeDeclarations: true, definitelyTypedAvailable: false };
  }
  if (exportsTypesCondition(pkgJson.exports)) {
    return { hasTypeDeclarations: true, definitelyTypedAvailable: false };
  }

  const mainRelative = typeof pkgJson.main === "string" ? pkgJson.main : "index.js";
  const mainDts = join(pkgDir, mainRelative.replace(/\.(c|m)?js$/, ".d.ts"));
  const implicitIndexDts = join(pkgDir, "index.d.ts");
  if ((await pathExists(mainDts)) || (await pathExists(implicitIndexDts))) {
    return { hasTypeDeclarations: true, definitelyTypedAvailable: false };
  }

  return { hasTypeDeclarations: false, definitelyTypedAvailable: await definitelyTypedExists(packageName) };
}

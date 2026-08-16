import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const INSTALL_TIMEOUT_MS = 180_000;

export interface PackageSpec {
  name: string;
  range: string;
}

export interface Workspace {
  root: string;
  packageName: string;
  packageVersion: string;
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

    const installedPkgJsonPath = join(root, "node_modules", ...name.split("/"), "package.json");
    const installedRaw = await readFile(installedPkgJsonPath, "utf8");
    const installedPkgJson = JSON.parse(installedRaw) as { version?: string };
    const packageVersion = installedPkgJson.version ?? range;

    const dispose = async () => {
      await rm(root, { recursive: true, force: true });
    };

    return { root, packageName: name, packageVersion, dispose };
  } catch (err) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

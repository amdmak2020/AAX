import fs from "node:fs";
import path from "node:path";

type LockPackageEntry = {
  hasInstallScript?: boolean;
  resolved?: string;
};

type LockFile = {
  packages?: Record<string, LockPackageEntry>;
};

const lockPath = path.join(process.cwd(), "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as LockFile;
const packages = lock.packages ?? {};
const expectedInstallScriptPackages = new Map<string, string>([
  ["esbuild", "Next.js toolchain binary"],
  ["fsevents", "optional macOS filesystem watcher dependency"],
  ["sharp", "image processing dependency used by Next.js"],
  ["unrs-resolver", "resolver binary dependency used by the build toolchain"]
]);

const installScriptPackages = Object.entries(packages)
  .filter(([packagePath, entry]) => packagePath && entry?.hasInstallScript)
  .map(([packagePath]) => packagePath.replace(/^node_modules\//, ""))
  .sort();

if (installScriptPackages.length === 0) {
  console.log("Dependency check passed. No install-script packages detected in package-lock.json.");
  process.exit(0);
}

const unexpectedInstallScriptPackages = installScriptPackages.filter((pkg) => !expectedInstallScriptPackages.has(pkg));

console.log("Install-script packages detected:");
for (const pkg of installScriptPackages) {
  const reason = expectedInstallScriptPackages.get(pkg);
  console.log(`- ${pkg}${reason ? ` (${reason})` : ""}`);
}

if (unexpectedInstallScriptPackages.length > 0) {
  console.error("Unexpected install-script packages detected:");
  for (const pkg of unexpectedInstallScriptPackages) {
    console.error(`- ${pkg}`);
  }
  process.exit(1);
}

console.log("Dependency check passed. Only expected install-script packages are present.");

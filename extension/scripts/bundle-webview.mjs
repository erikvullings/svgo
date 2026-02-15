import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(extensionDir, "..");
const sourceDir = path.join(repoRoot, "docs");
const targetDir = path.join(extensionDir, "webview");

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing build output: ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Bundled webview assets: ${sourceDir} -> ${targetDir}`);

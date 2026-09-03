import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [, , originArgument, outputArgument = "dist/manifest.pilot.xml"] =
  process.argv;

if (!originArgument) {
  throw new Error(
    "Usage: npm run manifest:hosted -- https://<host> [output-file]",
  );
}

const originUrl = new URL(originArgument);

if (
  originUrl.protocol !== "https:" ||
  originUrl.username ||
  originUrl.password ||
  originUrl.pathname !== "/" ||
  originUrl.search ||
  originUrl.hash
) {
  throw new Error("The hosted origin must be an HTTPS origin without a path.");
}

const origin = originUrl.origin;
const sourcePath = path.resolve("manifest.xml");
const outputPath = path.resolve(outputArgument);
const source = await readFile(sourcePath, "utf8");
const hosted = source.replaceAll("https://localhost:3000", origin);

if (hosted === source || hosted.includes("https://localhost:3000")) {
  throw new Error("The local manifest URLs could not be replaced.");
}

await writeFile(outputPath, hosted, "utf8");

console.log(`Hosted manifest: ${outputPath}`);
console.log(`NAA broker redirect: brk-multihub://${originUrl.host}`);

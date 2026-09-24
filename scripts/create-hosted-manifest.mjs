import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import AdmZip from "adm-zip";
import dotenv from "dotenv";

const isLocal = process.argv[2] === "--local";

if (process.argv.length > (isLocal ? 3 : 2)) {
  throw new Error("Only the optional --local mode is supported.");
}

if (isLocal) {
  dotenv.config({
    path: path.resolve(".env.local"),
    quiet: true,
  });
}

const originArgument = isLocal
  ? "https://localhost:3000"
  : process.env.OLHELPER_HOST_ORIGIN;
const clientId = process.env.OLHELPER_CLIENT_ID;

if (!originArgument) {
  throw new Error(
    "OLHELPER_HOST_ORIGIN must be set to the approved HTTPS deployment origin.",
  );
}

if (
  !clientId ||
  clientId === "00000000-0000-0000-0000-000000000000" ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    clientId,
  )
) {
  throw new Error("OLHELPER_CLIENT_ID must be set to a non-placeholder GUID.");
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
const sourcePath = path.resolve("appPackage/manifest.json");
const buildRoot = path.resolve("appPackage/build");
const outputDirectory = path.join(buildRoot, isLocal ? "local" : "hosted");
const outputPath = path.join(outputDirectory, "manifest.json");
const packagePath = path.join(
  buildRoot,
  isLocal ? "olhelper-local.zip" : "olhelper-pilot.zip",
);
const source = await readFile(sourcePath, "utf8");
const hosted = source
  .replaceAll("https://localhost:3000", origin)
  .replaceAll("localhost:3000", originUrl.host)
  .replaceAll("00000000-0000-0000-0000-000000000000", clientId);

if (
  !isLocal &&
  (hosted === source ||
    hosted.includes("https://localhost:3000") ||
    hosted.includes("localhost:3000"))
) {
  throw new Error("The local manifest URLs could not be replaced.");
}

if (hosted.includes("00000000-0000-0000-0000-000000000000")) {
  throw new Error("The Entra client ID placeholder could not be replaced.");
}

JSON.parse(hosted);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.join(outputDirectory, "assets"), { recursive: true });
await writeFile(outputPath, hosted, "utf8");
await Promise.all(
  ["outline.png", "color.png"].map((fileName) =>
    copyFile(
      path.resolve("appPackage/assets", fileName),
      path.join(outputDirectory, "assets", fileName),
    ),
  ),
);

const packageArchive = new AdmZip();
packageArchive.addLocalFile(outputPath);
packageArchive.addLocalFolder(path.join(outputDirectory, "assets"), "assets");
packageArchive.writeZip(packagePath);

console.log(`${isLocal ? "Local" : "Hosted"} manifest: ${outputPath}`);
console.log(`App package: ${packagePath}`);
console.log(`NAA broker redirect: brk-multihub://${originUrl.host}`);

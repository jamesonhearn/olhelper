import { readFile } from "node:fs/promises";
import path from "node:path";
import { approvedOrigin } from "./deployment-config.mjs";

const configuration = JSON.parse(
  await readFile(path.resolve("staticwebapp.config.json"), "utf8"),
);
const htmlRoute = configuration.routes.find(
  ({ route }) => route === "/*.html",
);
const expectedHeaders = {
  ...configuration.globalHeaders,
  ...(htmlRoute?.headers ?? {}),
};
const target = new URL("taskpane.html", `${approvedOrigin}/`);
const attempts = 10;
let verified = false;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(target, {
      method: "HEAD",
      redirect: "error",
    });

    if (!response.ok) {
      throw new Error(`received HTTP ${response.status}`);
    }

    for (const [name, expected] of Object.entries(expectedHeaders)) {
      const actual = response.headers.get(name);

      if (normalizeHeader(actual) !== normalizeHeader(expected)) {
        throw new Error(
          `${name} did not match the reviewed configuration`,
        );
      }
    }

    console.log(`Verified hosted security headers at ${target.origin}.`);
    verified = true;
    break;
  } catch (error) {
    if (attempt === attempts) {
      throw error;
    }

    console.warn(
      `Hosted security verification attempt ${attempt} failed; retrying.`,
    );
    await new Promise((resolve) => setTimeout(resolve, 6_000));
  }
}

if (!verified) {
  throw new Error("Hosted security headers could not be verified.");
}

function normalizeHeader(value) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

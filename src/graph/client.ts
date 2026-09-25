import { getGraphToken } from "../auth/auth";

const graphRoot = "https://graph.microsoft.com/v1.0";
const graphOrigin = "https://graph.microsoft.com";
const trackingIdPattern = /^\d{16,19}$/;
const ruleSummaryFields =
  "id,displayName,sequence,isEnabled,isReadOnly,hasError";
const ruleDetailFields =
  `${ruleSummaryFields},conditions,exceptions,actions`;

export class GraphError extends Error {
  constructor(public readonly status: number) {
    super(`Microsoft Graph returned HTTP ${status}`);
  }
}

interface ValidatedGraphRequest {
  url: string;
  method: string;
}

export async function graphRequest<T>(
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<T> {
  const request = validateGraphRequest(pathOrUrl, init);
  const token = await getGraphToken();
  const headers = new Headers();

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: init.body,
    signal: init.signal,
  });

  if (!response.ok) {
    throw new GraphError(response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function buildGraphUrl(
  pathOrUrl: string,
  init: RequestInit = {},
): string {
  return validateGraphRequest(pathOrUrl, init).url;
}

function validateGraphRequest(
  pathOrUrl: string,
  init: RequestInit,
): ValidatedGraphRequest {
  let url: URL;

  try {
    url = pathOrUrl.startsWith("/")
      ? new URL(`${graphRoot}${pathOrUrl}`)
      : new URL(pathOrUrl);
  } catch {
    throw new Error("Microsoft Graph URL is invalid.");
  }

  if (url.origin !== graphOrigin || url.username || url.password || url.hash) {
    throw new Error("Microsoft Graph URL is outside the allowed API boundary.");
  }

  const unsupportedOption = Object.keys(init).find(
    (name) => !["method", "body", "signal"].includes(name),
  );

  if (unsupportedOption) {
    throw new Error(
      `Microsoft Graph request option "${unsupportedOption}" is not allowed.`,
    );
  }

  const method = (init.method ?? "GET").toUpperCase();
  validateRequestContract(url, method, init.body);

  return { url: url.toString(), method };
}

function validateRequestContract(
  url: URL,
  method: string,
  body: BodyInit | null | undefined,
): void {
  if (method === "GET" && body !== undefined && body !== null) {
    throw new Error("Microsoft Graph GET requests cannot include a body.");
  }

  if (
    method === "GET" &&
    isInboxCollectionPath(url.pathname, "messages")
  ) {
    requireQuery(url, {
      "$select": "id,subject",
      "$top": "50",
      "$orderby": "receivedDateTime desc",
    }, true);
    return;
  }

  if (
    isInboxCollectionPath(url.pathname, "messageRules")
  ) {
    if (method === "GET") {
      requireQuery(url, { "$select": ruleSummaryFields }, true);
      return;
    }

    if (method === "POST") {
      requireNoQuery(url);
      validateRuleDefinition(parseBody(body), true);
      return;
    }
  }

  if (
    isInboxRulePath(url.pathname)
  ) {
    if (method === "GET") {
      requireQuery(url, { "$select": ruleDetailFields });
      return;
    }

    if (method === "PATCH") {
      requireNoQuery(url);
      validateRuleUpdate(parseBody(body));
      return;
    }

    if (method === "DELETE") {
      requireNoQuery(url);
      requireNoBody(body);
      return;
    }
  }

  if (url.pathname === "/v1.0/me/mailFolders") {
    if (method === "GET") {
      validateFolderQuery(url, new Set(["Support Cases"]), false);
      return;
    }

    if (method === "POST") {
      requireNoQuery(url);
      validateFolderBody(parseBody(body), new Set(["Support Cases"]));
      return;
    }
  }

  if (
    isChildFolderCollectionPath(url.pathname)
  ) {
    if (method === "GET") {
      validateFolderQuery(url, new Set(["Active", "Archived"]), true);
      return;
    }

    if (method === "POST") {
      requireNoQuery(url);
      validateFolderBody(parseBody(body));
      return;
    }
  }

  if (
    method === "POST" &&
    (
      /^\/v1\.0\/me\/mailFolders\/[^/]+\/move$/.test(url.pathname) ||
      /^\/v1\.0\/me\/messages\/[^/]+\/move$/.test(url.pathname)
    )
  ) {
    requireNoQuery(url);
    requireExactObject(parseBody(body), ["destinationId"]);
    requireNonEmptyString(parseBody(body).destinationId, "destinationId");
    return;
  }

  throw new Error(
    "Microsoft Graph request is outside the allowed operation boundary.",
  );
}

function validateFolderQuery(
  url: URL,
  allowedNames: ReadonlySet<string>,
  allowTrackingId: boolean,
): void {
  requireQuery(url, {
    "$select": "id,displayName",
    "$filter": url.searchParams.get("$filter") ?? "",
  }, true);

  const filter = url.searchParams.get("$filter") ?? "";
  const exactName = /^displayName eq '([^']+)'$/.exec(filter)?.[1];
  const trackingId =
    /^startswith\(displayName, '(\d{16,19})'\)$/.exec(filter)?.[1];

  if (
    (!exactName || !allowedNames.has(exactName)) &&
    (
      !allowTrackingId ||
      !trackingId ||
      !trackingIdPattern.test(trackingId)
    )
  ) {
    throw new Error("Microsoft Graph folder filter is not allowed.");
  }
}

function isInboxCollectionPath(
  pathname: string,
  collection: "messages" | "messageRules",
): boolean {
  return new RegExp(
    `^/v1\\.0/me/mailFolders(?:/inbox|\\('inbox'\\))/${collection}$`,
    "i",
  ).test(pathname);
}

function isInboxRulePath(pathname: string): boolean {
  return new RegExp(
    "^/v1\\.0/me/mailFolders(?:/inbox|\\('inbox'\\))/messageRules/[^/]+$",
    "i",
  ).test(pathname);
}

function isChildFolderCollectionPath(pathname: string): boolean {
  return (
    /^\/v1\.0\/me\/mailFolders\/[^/]+\/childFolders$/.test(pathname) ||
    /^\/v1\.0\/me\/mailFolders\('[^']+'\)\/childFolders$/.test(pathname)
  );
}

function validateFolderBody(
  value: Record<string, unknown>,
  allowedNames?: ReadonlySet<string>,
): void {
  requireExactObject(value, ["displayName", "isHidden"]);
  const displayName = requireNonEmptyString(value.displayName, "displayName");

  if (
    value.isHidden !== false ||
    (
      allowedNames
        ? !allowedNames.has(displayName)
        : !["Active", "Archived"].includes(displayName) &&
          !trackingIdPattern.test(displayName)
    )
  ) {
    throw new Error("Microsoft Graph folder definition is not allowed.");
  }
}

function validateRuleDefinition(
  value: Record<string, unknown>,
  requireSequence: boolean,
): void {
  const keys = [
    "displayName",
    ...(requireSequence ? ["sequence"] : []),
    "isEnabled",
    "conditions",
    "actions",
  ];
  requireExactObject(value, keys);

  const displayName = requireNonEmptyString(
    value.displayName,
    "displayName",
  );
  const trackingId = /^OLHelper \| TrackingID#(\d{16,19})$/.exec(
    displayName,
  )?.[1];

  if (!trackingId) {
    throw new Error("Microsoft Graph rule name is not allowed.");
  }

  if (
    requireSequence &&
    (
      !Number.isInteger(value.sequence) ||
      (value.sequence as number) <= 0
    )
  ) {
    throw new Error("Microsoft Graph rule sequence is not allowed.");
  }

  if (value.isEnabled !== false) {
    throw new Error("New or retargeted rules must start disabled.");
  }

  const conditions = requireObject(value.conditions, "conditions");
  requireExactObject(conditions, ["subjectContains"]);

  if (
    !Array.isArray(conditions.subjectContains) ||
    conditions.subjectContains.length !== 1 ||
    conditions.subjectContains[0] !== `TrackingID#${trackingId}`
  ) {
    throw new Error("Microsoft Graph rule condition is not allowed.");
  }

  const actions = requireObject(value.actions, "actions");
  requireExactObject(actions, ["moveToFolder", "stopProcessingRules"]);
  requireNonEmptyString(actions.moveToFolder, "moveToFolder");

  if (actions.stopProcessingRules !== false) {
    throw new Error("Microsoft Graph rule action is not allowed.");
  }
}

function validateRuleUpdate(value: Record<string, unknown>): void {
  if (
    Object.keys(value).length === 1 &&
    typeof value.isEnabled === "boolean"
  ) {
    return;
  }

  requireExactObject(value, ["isEnabled", "conditions", "actions"]);

  if (value.isEnabled !== false) {
    throw new Error("Retargeted rules must start disabled.");
  }

  const conditions = requireObject(value.conditions, "conditions");
  requireExactObject(conditions, ["subjectContains"]);

  if (
    !Array.isArray(conditions.subjectContains) ||
    conditions.subjectContains.length !== 1 ||
    typeof conditions.subjectContains[0] !== "string" ||
    !/^TrackingID#\d{16,19}$/.test(conditions.subjectContains[0])
  ) {
    throw new Error("Microsoft Graph rule condition is not allowed.");
  }

  const actions = requireObject(value.actions, "actions");
  requireExactObject(actions, ["moveToFolder", "stopProcessingRules"]);
  requireNonEmptyString(actions.moveToFolder, "moveToFolder");

  if (actions.stopProcessingRules !== false) {
    throw new Error("Microsoft Graph rule action is not allowed.");
  }
}

function requireQuery(
  url: URL,
  required: Readonly<Record<string, string>>,
  allowPagination = false,
): void {
  const allowed = new Set(Object.keys(required));

  if (allowPagination) {
    allowed.add("$skip");
    allowed.add("$skiptoken");
  }

  for (const [name, value] of Object.entries(required)) {
    if (
      url.searchParams.getAll(name).length !== 1 ||
      url.searchParams.get(name) !== value
    ) {
      throw new Error(`Microsoft Graph query "${name}" is not allowed.`);
    }
  }

  for (const name of url.searchParams.keys()) {
    const values = url.searchParams.getAll(name);

    if (!allowed.has(name) || values.length !== 1) {
      throw new Error(`Microsoft Graph query "${name}" is not allowed.`);
    }

    if (
      name === "$skip" &&
      (!/^\d+$/.test(values[0]) || Number(values[0]) < 0)
    ) {
      throw new Error("Microsoft Graph pagination value is not allowed.");
    }

    if (name === "$skiptoken" && values[0].length === 0) {
      throw new Error("Microsoft Graph pagination value is not allowed.");
    }
  }
}

function requireNoQuery(url: URL): void {
  if (url.search) {
    throw new Error("Microsoft Graph query parameters are not allowed.");
  }
}

function parseBody(
  body: BodyInit | null | undefined,
): Record<string, unknown> {
  if (typeof body !== "string") {
    throw new Error("Microsoft Graph request body must be JSON text.");
  }

  let value: unknown;

  try {
    value = JSON.parse(body);
  } catch {
    throw new Error("Microsoft Graph request body is invalid JSON.");
  }

  return requireObject(value, "body");
}

function requireObject(
  value: unknown,
  name: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Microsoft Graph ${name} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireExactObject(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("Microsoft Graph request body contains unsupported fields.");
  }
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Microsoft Graph field "${name}" is invalid.`);
  }

  return value;
}

function requireNoBody(body: BodyInit | null | undefined): void {
  if (body !== undefined && body !== null) {
    throw new Error("Microsoft Graph request body is not allowed.");
  }
}

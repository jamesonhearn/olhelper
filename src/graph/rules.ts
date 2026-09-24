import { graphRequest } from "./client";

export interface MessageRule {
  id: string;
  displayName: string;
  sequence: number;
  isEnabled: boolean;
  isReadOnly?: boolean;
  hasError?: boolean;
  conditions?: Record<string, unknown>;
  exceptions?: Record<string, unknown>;
  actions?: Record<string, unknown> & {
    moveToFolder?: string;
    stopProcessingRules?: boolean;
  };
}

interface RuleCollection {
  value: MessageRuleSummary[];
  "@odata.nextLink"?: string;
}

type MessageRuleSummary = Pick<
  MessageRule,
  | "id"
  | "displayName"
  | "sequence"
  | "isEnabled"
  | "isReadOnly"
  | "hasError"
>;

const ruleSummaryFields =
  "id,displayName,sequence,isEnabled,isReadOnly,hasError";
const ruleDetailFields =
  `${ruleSummaryFields},conditions,exceptions,actions`;

export function managedRuleName(trackingId: string): string {
  return `OLHelper | TrackingID#${trackingId}`;
}

export function isManagedRuleForTrackingId(
  displayName: string,
  trackingId: string,
): boolean {
  return (
    displayName.localeCompare(
      managedRuleName(trackingId),
      undefined,
      { sensitivity: "accent" },
    ) === 0
  );
}

function isConfigured(value: unknown): boolean {
  if (value === undefined || value === null || value === false) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(isConfigured);
  }

  return true;
}

function hasConfiguredFieldsOtherThan(
  values: Record<string, unknown> | undefined,
  allowedFields: ReadonlySet<string>,
): boolean {
  return Object.entries(values ?? {}).some(
    ([name, value]) => !allowedFields.has(name) && isConfigured(value),
  );
}

export function hasExpectedManagedRuleDefinition(
  rule: MessageRule,
  trackingId: string,
): boolean {
  const expectedSubject = `TrackingID#${trackingId}`;
  const subjects = rule.conditions?.subjectContains;

  return (
    isManagedRuleForTrackingId(rule.displayName, trackingId) &&
    rule.isReadOnly !== true &&
    rule.hasError !== true &&
    Array.isArray(subjects) &&
    subjects.length === 1 &&
    typeof subjects[0] === "string" &&
    subjects[0].localeCompare(expectedSubject, undefined, {
      sensitivity: "accent",
    }) === 0 &&
    !hasConfiguredFieldsOtherThan(
      rule.conditions,
      new Set(["subjectContains"]),
    ) &&
    !hasConfiguredFieldsOtherThan(rule.exceptions, new Set()) &&
    typeof rule.actions?.moveToFolder === "string" &&
    rule.actions.moveToFolder.length > 0 &&
    rule.actions.stopProcessingRules !== true &&
    !hasConfiguredFieldsOtherThan(
      rule.actions,
      new Set(["moveToFolder", "stopProcessingRules"]),
    )
  );
}

async function listAllRuleSummaries(): Promise<MessageRuleSummary[]> {
  let url: string | undefined =
    `/me/mailFolders/inbox/messageRules?$select=${ruleSummaryFields}`;
  const rules: MessageRuleSummary[] = [];

  while (url) {
    const page: RuleCollection = await graphRequest<RuleCollection>(url);
    rules.push(...page.value);
    url = page["@odata.nextLink"];
  }

  return rules;
}

async function getRule(ruleId: string): Promise<MessageRule> {
  return graphRequest<MessageRule>(
    `/me/mailFolders/inbox/messageRules/${encodeURIComponent(ruleId)}` +
      `?$select=${ruleDetailFields}`,
  );
}

async function getManagedRuleCandidates(
  summaries: MessageRuleSummary[],
  trackingId: string,
): Promise<MessageRule[]> {
  const matching = summaries.filter((rule) =>
    isManagedRuleForTrackingId(rule.displayName, trackingId),
  );

  if (matching.length > 1) {
    throw new Error(`Multiple OLHelper rules exist for ${trackingId}.`);
  }

  const rules = await Promise.all(matching.map((rule) => getRule(rule.id)));

  if (
    rules.length === 1 &&
    !hasExpectedManagedRuleDefinition(rules[0], trackingId)
  ) {
    throw new Error(
      `A rule named for ${trackingId} has unexpected conditions or actions and will not be modified.`,
    );
  }

  return rules;
}

export async function findCaseRule(
  trackingId: string,
): Promise<MessageRule | null> {
  const summaries = await listAllRuleSummaries();
  const existing = await getManagedRuleCandidates(summaries, trackingId);

  return existing[0] ?? null;
}

export async function ensureCaseRule(
  trackingId: string,
  folderId: string,
): Promise<MessageRule> {
  const summaries = await listAllRuleSummaries();
  const displayName = managedRuleName(trackingId);
  const existing = await getManagedRuleCandidates(summaries, trackingId);

  if (existing.length === 1) {
    const rule = existing[0];

    if (rule.actions?.moveToFolder !== folderId) {
      throw new Error(
        `An OLHelper rule for ${trackingId} targets another folder.`,
      );
    }

    return rule;
  }

  const sequence =
    Math.max(0, ...summaries.map((rule) => rule.sequence ?? 0)) + 1;

  return graphRequest<MessageRule>(
    "/me/mailFolders/inbox/messageRules",
    {
      method: "POST",
      body: JSON.stringify({
        displayName,
        sequence,
        isEnabled: false,
        conditions: {
          subjectContains: [`TrackingID#${trackingId}`],
        },
        actions: {
          moveToFolder: folderId,
          stopProcessingRules: false,
        },
      }),
    },
  );
}

export async function setCaseRuleEnabled(
  ruleId: string,
  isEnabled: boolean,
): Promise<MessageRule> {
  return graphRequest<MessageRule>(
    `/me/mailFolders/inbox/messageRules/${encodeURIComponent(ruleId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ isEnabled }),
    },
  );
}

export async function updateCaseRuleTarget(
  ruleId: string,
  trackingId: string,
  folderId: string,
): Promise<MessageRule> {
  return graphRequest<MessageRule>(
    `/me/mailFolders/inbox/messageRules/${encodeURIComponent(ruleId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        isEnabled: false,
        conditions: {
          subjectContains: [`TrackingID#${trackingId}`],
        },
        actions: {
          moveToFolder: folderId,
          stopProcessingRules: false,
        },
      }),
    },
  );
}

export async function deleteCaseRule(ruleId: string): Promise<void> {
  await graphRequest<void>(
    `/me/mailFolders/inbox/messageRules/${encodeURIComponent(ruleId)}`,
    { method: "DELETE" },
  );
}
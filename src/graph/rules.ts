import { graphRequest } from "./client";

interface MessageRule {
  id: string;
  displayName: string;
  sequence: number;
  isEnabled: boolean;
  actions?: {
    moveToFolder?: string;
  };
}

interface RuleCollection {
  value: MessageRule[];
  "@odata.nextLink"?: string;
}

function managedRuleName(trackingId: string): string {
  return `OLHelper | TrackingID#${trackingId}`;
}

async function listAllRules(): Promise<MessageRule[]> {
  let url: string | undefined =
    "/me/mailFolders/inbox/messageRules";
  const rules: MessageRule[] = [];

  while (url) {
    const page: RuleCollection = await graphRequest<RuleCollection>(url);
    rules.push(...page.value);
    url = page["@odata.nextLink"];
  }

  return rules;
}

export async function ensureCaseRule(
  trackingId: string,
  folderId: string,
): Promise<MessageRule> {
  const rules = await listAllRules();
  const displayName = managedRuleName(trackingId);
  const existing = rules.filter(
    (rule) => rule.displayName === displayName,
  );

  if (existing.length > 1) {
    throw new Error(`Multiple OLHelper rules exist for ${trackingId}.`);
  }

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
    Math.max(0, ...rules.map((rule) => rule.sequence ?? 0)) + 1;

  return graphRequest<MessageRule>(
    "/me/mailFolders/inbox/messageRules",
    {
      method: "POST",
      body: JSON.stringify({
        displayName,
        sequence,
        isEnabled: true,
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
import {
  ensureActiveCaseFolder,
  getCaseFolderState,
  moveCaseFolder,
  type CaseFolderState,
  type CaseLocation,
  type MailFolder,
} from "../graph/folders";
import { moveMessage, findInboxMessagesBySubject } from "../graph/messages";
import {
  deleteCaseRule,
  ensureCaseRule,
  findCaseRule,
  setCaseRuleEnabled,
  updateCaseRuleTarget,
  type MessageRule,
} from "../graph/rules";

export interface CaseMailboxOperations {
  ensureActiveFolder(trackingId: string): Promise<MailFolder>;
  getFolderState(trackingId: string): Promise<CaseFolderState>;
  moveFolder(
    folderId: string,
    destination: Exclude<CaseLocation, "untracked">,
  ): Promise<MailFolder>;
  moveMessage(messageId: string, folderId: string): Promise<{ id: string }>;
  findInboxMessages(trackingId: string, excludeId: string): Promise<string[]>;
  ensureRule(trackingId: string, folderId: string): Promise<MessageRule>;
  findRule(trackingId: string): Promise<MessageRule | null>;
  setRuleEnabled(ruleId: string, enabled: boolean): Promise<MessageRule>;
  updateRuleTarget(
    ruleId: string,
    trackingId: string,
    folderId: string,
  ): Promise<MessageRule>;
  deleteRule(ruleId: string): Promise<void>;
}

export interface TrackCaseResult {
  trackingId: string;
  folderId: string;
  ruleId: string;
  movedMessageId: string;
  sweptMessageCount: number;
}

export interface CaseActionResult {
  trackingId: string;
  location: Exclude<CaseLocation, "untracked">;
  folderId: string;
}

export interface CaseStatus {
  location: CaseLocation;
  routing:
    | "enabled"
    | "disabled"
    | "missing"
    | "mistargeted"
    | "not-applicable";
}

export const graphCaseMailboxOperations: CaseMailboxOperations = {
  ensureActiveFolder: ensureActiveCaseFolder,
  getFolderState: getCaseFolderState,
  moveFolder: moveCaseFolder,
  moveMessage,
  ensureRule: ensureCaseRule,
  findRule: findCaseRule,
  setRuleEnabled: setCaseRuleEnabled,
  updateRuleTarget: updateCaseRuleTarget,
  deleteRule: deleteCaseRule,
  findInboxMessages: (trackingId, excludeId) =>
    findInboxMessagesBySubject(trackingId, excludeId),
};

export async function trackCase(
  trackingId: string,
  messageId: string,
  operations: CaseMailboxOperations = graphCaseMailboxOperations,
): Promise<TrackCaseResult> {
  const state = await operations.getFolderState(trackingId);

  if (state.location === "archived") {
    throw new Error(
      `Case ${trackingId} is archived. Reopen it before tracking new messages.`,
    );
  }

  const folder =
    state.folder ?? (await operations.ensureActiveFolder(trackingId));
  const rule = await operations.ensureRule(trackingId, folder.id);
  const movedMessage = await operations.moveMessage(messageId, folder.id);

  try {
    await operations.setRuleEnabled(rule.id, true);
  } catch (error) {
    throw new Error(
      `The message was moved, but routing could not be enabled for ${trackingId}. Use Repair routing before continuing.`,
      { cause: error },
    );
  }

  // Sweep any case email already sitting in the Inbox into the case folder. The
  // Exchange rule only routes future arrivals, so without this, messages that
  // arrived before Track would be left behind. Best effort: a sweep failure must
  // not fail the Track itself, since the folder, move, and rule already succeeded.
  let sweptMessageCount = 0;
  try {
    const pendingIds = await operations.findInboxMessages(
      trackingId,
      movedMessage.id,
    );

    for (const pendingId of pendingIds) {
      try {
        await operations.moveMessage(pendingId, folder.id);
        sweptMessageCount += 1;
      } catch {
        // Skip an individual message that cannot be moved.
      }
    }
  } catch {
    // Inbox sweep is best effort; ignore discovery failures.
  }

  return {
    trackingId,
    folderId: folder.id,
    ruleId: rule.id,
    movedMessageId: movedMessage.id,
    sweptMessageCount,
  };
}

export async function archiveCase(
  trackingId: string,
  operations: CaseMailboxOperations = graphCaseMailboxOperations,
): Promise<CaseActionResult> {
  const state = await operations.getFolderState(trackingId);

  if (state.location !== "active" || !state.folder) {
    throw new Error(`Case ${trackingId} is not active.`);
  }

  const rule = await operations.findRule(trackingId);
  const wasEnabled = rule?.isEnabled ?? false;

  if (rule?.isEnabled) {
    await operations.setRuleEnabled(rule.id, false);
  }

  let folder: MailFolder;

  try {
    folder = await operations.moveFolder(state.folder.id, "archived");
  } catch (error) {
    if (rule && wasEnabled) {
      try {
        await operations.setRuleEnabled(rule.id, true);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Archiving ${trackingId} failed and its routing rule could not be re-enabled. Use Repair routing.`,
        );
      }
    }

    throw error;
  }

  if (rule) {
    try {
      await operations.deleteRule(rule.id);
    } catch (error) {
      throw new Error(
        `Case ${trackingId} was archived, but its disabled OLHelper rule could not be removed.`,
        { cause: error },
      );
    }
  }

  return {
    trackingId,
    location: "archived",
    folderId: folder.id,
  };
}

export async function reopenCase(
  trackingId: string,
  operations: CaseMailboxOperations = graphCaseMailboxOperations,
): Promise<CaseActionResult> {
  const state = await operations.getFolderState(trackingId);

  if (state.location !== "archived" || !state.folder) {
    throw new Error(`Case ${trackingId} is not archived.`);
  }

  const staleRule = await operations.findRule(trackingId);

  if (staleRule) {
    await operations.deleteRule(staleRule.id);
  }

  const folder = await operations.moveFolder(state.folder.id, "active");
  const rule = await operations.ensureRule(trackingId, folder.id);

  try {
    await operations.setRuleEnabled(rule.id, true);
  } catch (error) {
    throw new Error(
      `Case ${trackingId} was reopened, but routing could not be enabled. Use Repair routing.`,
      { cause: error },
    );
  }

  return {
    trackingId,
    location: "active",
    folderId: folder.id,
  };
}

export async function repairCaseRouting(
  trackingId: string,
  operations: CaseMailboxOperations = graphCaseMailboxOperations,
): Promise<CaseActionResult> {
  const state = await operations.getFolderState(trackingId);

  if (state.location !== "active" || !state.folder) {
    throw new Error(`Case ${trackingId} is not active.`);
  }

  const existingRule = await operations.findRule(trackingId);
  const rule = !existingRule
    ? await operations.ensureRule(trackingId, state.folder.id)
    : existingRule.actions?.moveToFolder !== state.folder.id
      ? await operations.updateRuleTarget(
          existingRule.id,
          trackingId,
          state.folder.id,
        )
      : existingRule;
  await operations.setRuleEnabled(rule.id, true);

  return {
    trackingId,
    location: "active",
    folderId: state.folder.id,
  };
}

export async function getCaseStatus(
  trackingId: string,
  operations: CaseMailboxOperations = graphCaseMailboxOperations,
): Promise<CaseStatus> {
  const state = await operations.getFolderState(trackingId);

  if (state.location !== "active") {
    return {
      location: state.location,
      routing: "not-applicable",
    };
  }

  const rule = await operations.findRule(trackingId);

  return {
    location: "active",
    routing: !rule
      ? "missing"
      : rule.actions?.moveToFolder !== state.folder?.id
        ? "mistargeted"
        : rule.isEnabled
          ? "enabled"
          : "disabled",
  };
}

import "./taskpane.css";
import {
  archiveCase,
  getCaseStatus,
  reopenCase,
  repairCaseRouting,
} from "../cases/case-workflows";
import { trackSelectedCase } from "../cases/track-case";
import {
  caseFolderName,
  extractTrackingId,
} from "../cases/tracking-id";
import {
  type CaseLocation,
} from "../graph/folders";

type CaseAction = "track" | "archive" | "reopen" | "repair";
type RoutingState =
  | "enabled"
  | "disabled"
  | "missing"
  | "mistargeted"
  | "not-applicable";

interface ActionDefinition {
  confirmation: string;
  details: string;
  progress: string;
  run: () => Promise<void>;
}

Office.onReady(() => {
  if (
    !Office.context.requirements.isSetSupported(
      "NestedAppAuth",
      "1.1",
    )
  ) {
    setStatus(
      "This Outlook client does not support the authentication required by OLHelper.",
    );
    disableAllActions();
    return;
  }

  const item = Office.context.mailbox.item;

  if (!item) {
    setStatus("Open a received message to use OLHelper.");
    disableAllActions();
    return;
  }

  const subject = item.subject ?? "";
  const extractedTrackingId = extractTrackingId(subject);

  document.getElementById("subject")!.textContent = subject;
  document.getElementById("tracking-id")!.textContent =
    extractedTrackingId
      ? `Tracking ID: ${extractedTrackingId}`
      : "No Tracking ID detected";

  if (!extractedTrackingId) {
    disableAllActions();
    return;
  }

  const trackingId = caseFolderName(extractedTrackingId);
  const mailbox =
    Office.context.mailbox.userProfile.emailAddress ||
    "the signed-in mailbox";
  const checkStatusButton = getButton("check-status");
  const cancelButton = getButton("cancel-action");
  const confirmButton = getButton("confirm-action");
  let pendingAction: CaseAction | null = null;

  const definitions: Record<CaseAction, ActionDefinition> = {
    track: {
      confirmation: `Track ${trackingId} in ${mailbox}?`,
      details:
        "OLHelper will create or reuse the active case folder, move the selected message, and enable persistent Inbox routing.",
      progress: "Creating case routing and moving the message...",
      run: async () => {
        const result = await trackSelectedCase();
        setStatus(
          `Case ${result.trackingId} is active and the selected message was moved.`,
        );
        showActionsForState("active", "enabled");
      },
    },
    archive: {
      confirmation: `Archive ${trackingId} in ${mailbox}?`,
      details:
        "OLHelper will stop persistent routing, move the entire case folder from Active to Archived, and remove its managed Inbox rule.",
      progress: "Stopping routing and archiving the case...",
      run: async () => {
        await archiveCase(trackingId);
        setStatus(
          `Case ${trackingId} is archived. New matching messages will remain in the Inbox.`,
        );
        showActionsForState("archived", "not-applicable");
      },
    },
    reopen: {
      confirmation: `Reopen ${trackingId} in ${mailbox}?`,
      details:
        "OLHelper will move the case folder back to Active and restore persistent Inbox routing.",
      progress: "Reopening the case and restoring routing...",
      run: async () => {
        await reopenCase(trackingId);
        setStatus(`Case ${trackingId} is active and routing is enabled.`);
        showActionsForState("active", "enabled");
      },
    },
    repair: {
      confirmation: `Repair routing for ${trackingId}?`,
      details:
        "OLHelper will verify that the active case folder has one managed Inbox rule targeting the correct folder and enable it.",
      progress: "Checking and repairing case routing...",
      run: async () => {
        await repairCaseRouting(trackingId);
        setStatus(`Routing for case ${trackingId} is enabled.`);
        showActionsForState("active", "enabled");
      },
    },
  };

  for (const action of Object.keys(definitions) as CaseAction[]) {
    getButton(`${action}-case`).addEventListener("click", () => {
      pendingAction = action;
      const definition = definitions[action];

      document.getElementById("confirmation-message")!.textContent =
        definition.confirmation;
      document.getElementById("confirmation-details")!.textContent =
        definition.details;
      document.getElementById("confirmation")!.hidden = false;
      setActionButtonsDisabled(true);
      confirmButton.focus();
      setStatus("Review and confirm the mailbox changes.");
    });
  }

  cancelButton.addEventListener("click", () => {
    pendingAction = null;
    closeConfirmation();
    setStatus("No mailbox changes were made.");
  });

  confirmButton.addEventListener("click", async () => {
    if (!pendingAction) {
      return;
    }

    const action = pendingAction;
    const definition = definitions[action];
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    setStatus(definition.progress);

    try {
      await definition.run();
      pendingAction = null;
      closeConfirmation();
    } catch (error) {
      const errorMessage =
        `Unable to ${action} case: ${getErrorMessage(error)}`;
      pendingAction = null;
      closeConfirmation();

      try {
        const state = await getCaseStatus(trackingId);
        showActionsForState(state.location, state.routing);
      } catch {
        showActionsForState("untracked");
      }

      setStatus(errorMessage);
    }
  });

  checkStatusButton.addEventListener("click", async () => {
    checkStatusButton.disabled = true;
    setStatus("Checking case status...");

    try {
      const state = await getCaseStatus(trackingId);
      showActionsForState(state.location, state.routing);
      setStatus(
        state.location === "untracked"
          ? `Case ${trackingId} is not currently tracked.`
          : state.location === "archived"
            ? `Case ${trackingId} is archived and persistent routing is stopped.`
            : state.routing === "enabled"
              ? `Case ${trackingId} is active and routing is enabled.`
              : `Case ${trackingId} is active, but routing needs repair.`,
      );
    } catch (error) {
      setStatus(`Unable to check case status: ${getErrorMessage(error)}`);
    } finally {
      checkStatusButton.disabled = false;
    }
  });
});

function showActionsForState(
  location: CaseLocation,
  routing: RoutingState = "not-applicable",
): void {
  document.getElementById("case-state")!.textContent =
    location === "untracked"
      ? "Status: Not tracked"
      : location === "archived"
        ? "Status: Archived"
        : `Status: Active | Routing: ${
            routing === "enabled"
              ? "Enabled"
              : routing === "mistargeted"
                ? "Wrong destination"
                : "Needs repair"
          }`;

  getButton("track-case").hidden = location === "archived";
  getButton("archive-case").hidden = location !== "active";
  getButton("repair-case").hidden =
    location !== "active" || routing === "enabled";
  getButton("reopen-case").hidden = location !== "archived";
}

function closeConfirmation(): void {
  document.getElementById("confirmation")!.hidden = true;
  setActionButtonsDisabled(false);
  getButton("confirm-action").disabled = false;
  getButton("cancel-action").disabled = false;
}

function setActionButtonsDisabled(disabled: boolean): void {
  for (const id of [
    "check-status",
    "track-case",
    "archive-case",
    "reopen-case",
    "repair-case",
  ]) {
    getButton(id).disabled = disabled;
  }
}

function disableAllActions(): void {
  setActionButtonsDisabled(true);
}

function getButton(id: string): HTMLButtonElement {
  return document.getElementById(id) as HTMLButtonElement;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function setStatus(message: string): void {
  document.getElementById("status")!.textContent = message;
}

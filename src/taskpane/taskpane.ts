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

let confirmationTrigger: HTMLButtonElement | null = null;

Office.onReady(() => {
  initializeOfficeTheme();

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
        "OLHelper will create or reuse the active case folder, move the selected message, scan up to the 250 most recent Inbox messages for the complete TrackingID token, move matching messages, and enable persistent Inbox routing.",
      progress: "Creating case routing and moving the message...",
      run: async () => {
        const result = await trackSelectedCase();
        const { sweep } = result;
        let sweptNote = "";

        if (sweep.discoveryFailed) {
          sweptNote =
            " The case is active, but prior Inbox messages could not be checked.";
        } else {
          sweptNote =
            ` Checked ${sweep.scannedMessageCount} Inbox message(s) and moved ` +
            `${sweep.movedMessageCount} matching message(s).`;

          if (sweep.failedMessageCount > 0) {
            sweptNote +=
              ` ${sweep.failedMessageCount} matching message(s) could not be moved.`;
          }

          if (!sweep.scanComplete) {
            sweptNote +=
              " The scan limit was reached, so older Inbox messages were not checked.";
          }
        }

        setStatus(
          `Case ${result.trackingId} is active and the selected message was moved.${sweptNote}`,
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
    const actionButton = getButton(`${action}-case`);

    actionButton.addEventListener("click", () => {
      pendingAction = action;
      confirmationTrigger = actionButton;
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

  const focusTarget =
    confirmationTrigger && !confirmationTrigger.hidden
      ? confirmationTrigger
      : getButton("check-status");
  confirmationTrigger = null;
  focusTarget.focus();
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

function initializeOfficeTheme(): void {
  if (
    !Office.context.requirements.isSetSupported("Mailbox", "1.14")
  ) {
    return;
  }

  applyOfficeTheme(Office.context.officeTheme);
  Office.context.mailbox.addHandlerAsync(
    Office.EventType.OfficeThemeChanged,
    (event: Office.OfficeThemeChangedEventArgs) => {
      applyOfficeTheme(event.officeTheme);
    },
    (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        console.warn("OLHelper could not monitor Office theme changes.");
      }
    },
  );
}

function applyOfficeTheme(theme: Office.OfficeTheme): void {
  const root = document.documentElement;

  setThemeColor("--body-background", theme.bodyBackgroundColor);
  setThemeColor("--body-foreground", theme.bodyForegroundColor);
  setThemeColor("--surface-background", theme.controlBackgroundColor);
  setThemeColor("--border-color", theme.controlForegroundColor);

  root.dataset.officeTheme = isDarkColor(theme.bodyBackgroundColor)
    ? "dark"
    : "light";
}

function setThemeColor(property: string, value: string): void {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    document.documentElement.style.setProperty(property, value);
  }
}

function isDarkColor(value: string): boolean {
  const match = /^#([0-9a-f]{6})$/i.exec(value);

  if (!match) {
    return false;
  }

  const color = Number.parseInt(match[1], 16);
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;

  return red * 0.299 + green * 0.587 + blue * 0.114 < 128;
}

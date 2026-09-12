import { getCaseStatus } from "../cases/case-workflows";
import { describeCaseStatus } from "../cases/case-status";
import {
  caseFolderName,
  extractTrackingId,
} from "../cases/tracking-id";

const STATUS_NOTIFICATION_KEY = "olhelper-case-status";
const MAX_NOTIFICATION_LENGTH = 150;

Office.onReady(() => {
  Office.actions.associate(
    "checkCaseStatusCommand",
    checkCaseStatusCommand,
  );
});

async function checkCaseStatusCommand(
  event: Office.AddinCommands.Event,
): Promise<void> {
  const item = Office.context.mailbox.item;
  let progressNotificationAdded = false;

  try {
    if (!item) {
      throw new Error("Open a received message to check case status.");
    }

    const trackingId = extractTrackingId(item.subject ?? "");

    if (!trackingId) {
      throw new Error(
        "The selected message does not contain a supported Tracking ID.",
      );
    }

    await addNotification(item.notificationMessages, {
      type: Office.MailboxEnums.ItemNotificationMessageType.ProgressIndicator,
      message: `Checking case ${trackingId}...`,
    });
    progressNotificationAdded = true;

    const normalizedTrackingId = caseFolderName(trackingId);
    const state = await getCaseStatus(normalizedTrackingId);
    await replaceNotification(item.notificationMessages, {
      type:
        Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
      message: describeCaseStatus(normalizedTrackingId, state),
      icon: "Icon.16",
      persistent: false,
    });
  } catch (error) {
    const details: Office.NotificationMessageDetails = {
      type: Office.MailboxEnums.ItemNotificationMessageType.ErrorMessage,
      message: truncateNotification(
        `Unable to check case status: ${getErrorMessage(error)}`,
      ),
    };

    try {
      if (item) {
        if (progressNotificationAdded) {
          await replaceNotification(item.notificationMessages, details);
        } else {
          await addNotification(item.notificationMessages, details);
        }
      }
    } catch {
      console.error("OLHelper could not display the case status result.");
    }
  } finally {
    event.completed();
  }
}

function addNotification(
  notifications: Office.NotificationMessages,
  details: Office.NotificationMessageDetails,
): Promise<void> {
  return new Promise((resolve, reject) => {
    notifications.addAsync(
      STATUS_NOTIFICATION_KEY,
      details,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(
            new Error(
              result.error?.message ?? "Unable to display an Outlook notification.",
            ),
          );
        }
      },
    );
  });
}

function replaceNotification(
  notifications: Office.NotificationMessages,
  details: Office.NotificationMessageDetails,
): Promise<void> {
  return new Promise((resolve, reject) => {
    notifications.replaceAsync(
      STATUS_NOTIFICATION_KEY,
      details,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(
            new Error(
              result.error?.message ?? "Unable to update an Outlook notification.",
            ),
          );
        }
      },
    );
  });
}

function truncateNotification(message: string): string {
  return message.length <= MAX_NOTIFICATION_LENGTH
    ? message
    : `${message.slice(0, MAX_NOTIFICATION_LENGTH - 3)}...`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

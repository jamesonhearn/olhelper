import "./taskpane.css";
import { trackSelectedCase } from "../cases/track-case";
import { extractTrackingId } from "../cases/tracking-id";

Office.onReady(() => {
  const item = Office.context.mailbox.item;

  if (!item) {
    setStatus("Open a received message to use OLHelper.");
    return;
  }

  const subject = item.subject ?? "";
  const trackingId = extractTrackingId(subject);

  document.getElementById("subject")!.textContent = subject;
  document.getElementById("tracking-id")!.textContent =
    trackingId
      ? `Tracking ID: ${trackingId}`
      : "No Tracking ID detected";

  const button = document.getElementById(
    "track-case",
  ) as HTMLButtonElement;
  const confirmation = document.getElementById(
    "confirmation",
  ) as HTMLElement;
  const confirmationMessage = document.getElementById(
    "confirmation-message",
  ) as HTMLElement;
  const confirmButton = document.getElementById(
    "confirm-track-case",
  ) as HTMLButtonElement;
  const cancelButton = document.getElementById(
    "cancel-track-case",
  ) as HTMLButtonElement;

  button.disabled = !trackingId;

  if (!trackingId) {
    return;
  }

  button.addEventListener("click", () => {
    const mailbox =
      Office.context.mailbox.userProfile.emailAddress ||
      "the signed-in mailbox";

    confirmationMessage.textContent =
      `Track ${trackingId} in ${mailbox}?`;
    confirmation.hidden = false;
    button.hidden = true;
    confirmButton.focus();
    setStatus("Review and confirm the mailbox changes.");
  });

  cancelButton.addEventListener("click", () => {
    confirmation.hidden = true;
    button.hidden = false;
    button.focus();
    setStatus("No mailbox changes were made.");
  });

  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    setStatus("Creating case routing...");

    try {
      const result = await trackSelectedCase();
      setStatus(
        `Tracking ${result.trackingId}. The message was moved successfully.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error";
      setStatus(`Unable to track case: ${message}`);
      confirmButton.disabled = false;
      cancelButton.disabled = false;
    }
  });
});

function setStatus(message: string): void {
  document.getElementById("status")!.textContent = message;
}
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

  button.disabled = !trackingId;

  button.addEventListener("click", async () => {
    const mailbox =
      Office.context.mailbox.userProfile.emailAddress ||
      "the signed-in mailbox";
    const confirmed = window.confirm(
      `Track ${trackingId} in ${mailbox}?\n\n` +
        "OLHelper will create or reuse a case folder, create an Inbox rule, " +
        "and move the selected message.",
    );

    if (!confirmed) {
      setStatus("No mailbox changes were made.");
      return;
    }

    button.disabled = true;
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
      button.disabled = false;
    }
  });
});

function setStatus(message: string): void {
  document.getElementById("status")!.textContent = message;
}
import { caseFolderName, extractTrackingId } from "./tracking-id";
import { trackCase, type TrackCaseResult } from "./case-workflows";
import { getSelectedMessage } from "../outlook/selected-message";

export async function trackSelectedCase(): Promise<TrackCaseResult> {
  const message = getSelectedMessage();
  const trackingId = extractTrackingId(message.subject);

  if (!trackingId) {
    throw new Error(
      "No supported TrackingID was found in the message subject.",
    );
  }

  return trackCase(
    caseFolderName(trackingId),
    message.graphMessageId,
  );
}
import { ensureActiveCaseFolder } from "../graph/folders";
import { moveMessage } from "../graph/messages";
import { ensureCaseRule } from "../graph/rules";
import {
  caseFolderName,
  extractTrackingId,
} from "./tracking-id";
import { getSelectedMessage } from "../outlook/selected-message";

export interface TrackCaseResult {
  trackingId: string;
  folderId: string;
  ruleId: string;
  movedMessageId: string;
}

export async function trackSelectedCase(): Promise<TrackCaseResult> {
  const message = getSelectedMessage();
  const trackingId = extractTrackingId(message.subject);

  if (!trackingId) {
    throw new Error(
      "No supported TrackingID was found in the message subject.",
    );
  }

  const folder = await ensureActiveCaseFolder(
    caseFolderName(trackingId),
  );

  // Establish persistent routing before moving the current message.
  const rule = await ensureCaseRule(trackingId, folder.id);

  const movedMessage = await moveMessage(
    message.graphMessageId,
    folder.id,
  );

  return {
    trackingId,
    folderId: folder.id,
    ruleId: rule.id,
    movedMessageId: movedMessage.id,
  };
}
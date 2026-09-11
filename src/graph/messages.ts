import { graphRequest } from "./client";

interface Message {
  id: string;
  subject?: string;
  parentFolderId?: string;
}

interface MessageCollection {
  value: Message[];
  "@odata.nextLink"?: string;
}

export interface InboxMessageSearchResult {
  messageIds: string[];
  scannedMessageCount: number;
  scanComplete: boolean;
}

export async function moveMessage(
  messageId: string,
  destinationFolderId: string,
): Promise<Message> {
  return graphRequest<Message>(
    `/me/messages/${encodeURIComponent(messageId)}/move`,
    {
      method: "POST",
      body: JSON.stringify({
        destinationId: destinationFolderId,
      }),
    },
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function subjectHasTrackingId(
  subject: string,
  trackingId: string,
): boolean {
  return new RegExp(
    `TrackingID#${escapeRegExp(trackingId)}(?!\\d)`,
    "i",
  ).test(subject);
}

export async function findInboxMessagesByTrackingId(
  trackingId: string,
  excludeId?: string,
  maxScan = 250,
): Promise<InboxMessageSearchResult> {
  if (!Number.isInteger(maxScan) || maxScan <= 0) {
    throw new Error("Inbox scan limit must be a positive integer.");
  }

  let url: string | undefined =
    "/me/mailFolders/inbox/messages" +
    "?$select=id,subject&$top=50&$orderby=receivedDateTime desc";
  const messageIds: string[] = [];
  let scanned = 0;

  while (url && scanned < maxScan) {
    const page: MessageCollection =
      await graphRequest<MessageCollection>(url);
    const remaining = maxScan - scanned;
    const messages = page.value.slice(0, remaining);

    for (const message of messages) {
      if (
        message.id !== excludeId &&
        message.subject &&
        subjectHasTrackingId(message.subject, trackingId)
      ) {
        messageIds.push(message.id);
      }
    }

    scanned += messages.length;

    if (page.value.length > remaining) {
      return {
        messageIds,
        scannedMessageCount: scanned,
        scanComplete: false,
      };
    }

    url = page["@odata.nextLink"];
  }

  return {
    messageIds,
    scannedMessageCount: scanned,
    scanComplete: !url,
  };
}

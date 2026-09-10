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

// Find messages currently in the Inbox whose subject contains the given case
// number. Used to sweep pre-existing case email into the case folder at Track
// time, since an Exchange Inbox rule only routes future arrivals. Scans the most
// recent messages (newest first) up to maxScan and matches on an exact subject
// substring so a 16-digit main number also catches 19-digit collaboration
// subjects. excludeId omits the already-moved selected message.
export async function findInboxMessagesBySubject(
  needle: string,
  excludeId?: string,
  maxScan = 250,
): Promise<string[]> {
  let url: string | undefined =
    "/me/mailFolders/inbox/messages" +
    "?$select=id,subject&$top=50&$orderby=receivedDateTime desc";
  const matches: string[] = [];
  let scanned = 0;

  while (url && scanned < maxScan) {
    const page: MessageCollection =
      await graphRequest<MessageCollection>(url);

    for (const message of page.value) {
      scanned += 1;
      if (
        message.id !== excludeId &&
        message.subject &&
        message.subject.includes(needle)
      ) {
        matches.push(message.id);
      }
    }

    url = page["@odata.nextLink"];
  }

  return matches;
}

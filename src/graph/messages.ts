import { graphRequest } from "./client";

interface Message {
  id: string;
  subject?: string;
  parentFolderId?: string;
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

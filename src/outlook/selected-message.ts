export interface SelectedMessage {
  graphMessageId: string;
  subject: string;
}

export function getSelectedMessage(): SelectedMessage {
  const item = Office.context.mailbox.item;

  if (!item) {
    throw new Error("No Outlook message is selected.");
  }

  const subject = item.subject?.trim();
  const outlookItemId = item.itemId;

  if (!subject) {
    throw new Error("The selected message has no subject.");
  }

  if (!outlookItemId) {
    throw new Error("Outlook has not assigned an ID to this message.");
  }

  const graphMessageId = Office.context.mailbox.convertToRestId(
    outlookItemId,
    Office.MailboxEnums.RestVersion.v2_0,
  );

  return {
    graphMessageId,
    subject,
  };
}

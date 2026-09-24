export interface SelectedMessage {
  outlookItemId: string;
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
    outlookItemId,
    graphMessageId,
    subject,
  };
}

export function assertSelectedMessage(expected: SelectedMessage): void {
  const current = getSelectedMessage();

  if (
    current.outlookItemId !== expected.outlookItemId ||
    current.graphMessageId !== expected.graphMessageId ||
    current.subject !== expected.subject
  ) {
    throw new Error(
      "The selected Outlook message changed. Review the new message before continuing.",
    );
  }
}

import { graphRequest } from "./client";

export interface MailFolder {
  id: string;
  displayName: string;
}

interface FolderCollection {
  value: MailFolder[];
  "@odata.nextLink"?: string;
}

function escapeODataString(value: string): string {
  return value.replaceAll("'", "''");
}

async function findFolder(
  collectionPath: string,
  displayName: string,
): Promise<MailFolder | null> {
  const filter = encodeURIComponent(
    `displayName eq '${escapeODataString(displayName)}'`,
  );

  const result = await graphRequest<FolderCollection>(
    `${collectionPath}?$select=id,displayName&$filter=${filter}`,
  );

  if (result.value.length > 1) {
    throw new Error(`Multiple folders named "${displayName}" were found.`);
  }

  return result.value[0] ?? null;
}

async function createFolder(
  collectionPath: string,
  displayName: string,
): Promise<MailFolder> {
  return graphRequest<MailFolder>(collectionPath, {
    method: "POST",
    body: JSON.stringify({
      displayName,
      isHidden: false,
    }),
  });
}

async function ensureFolder(
  collectionPath: string,
  displayName: string,
): Promise<MailFolder> {
  return (
    (await findFolder(collectionPath, displayName)) ??
    (await createFolder(collectionPath, displayName))
  );
}

export async function ensureActiveCaseFolder(
  trackingId: string,
): Promise<MailFolder> {
  const root = await ensureFolder("/me/mailFolders", "Support Cases");

  const active = await ensureFolder(
    `/me/mailFolders/${encodeURIComponent(root.id)}/childFolders`,
    "Active",
  );

  return ensureFolder(
    `/me/mailFolders/${encodeURIComponent(active.id)}/childFolders`,
    trackingId,
  );
}
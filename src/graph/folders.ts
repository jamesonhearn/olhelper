import { graphRequest } from "./client";

export interface MailFolder {
  id: string;
  displayName: string;
}

export type CaseLocation = "active" | "archived" | "untracked";

export interface CaseFolderState {
  location: CaseLocation;
  folder: MailFolder | null;
}

interface FolderCollection {
  value: MailFolder[];
  "@odata.nextLink"?: string;
}

const rootFolderName = "Support Cases";
const activeFolderName = "Active";
const archivedFolderName = "Archived";

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

async function findCaseContainer(
  displayName: string,
): Promise<MailFolder | null> {
  const root = await findFolder("/me/mailFolders", rootFolderName);

  if (!root) {
    return null;
  }

  return findFolder(
    `/me/mailFolders/${encodeURIComponent(root.id)}/childFolders`,
    displayName,
  );
}

async function ensureCaseContainer(
  displayName: string,
): Promise<MailFolder> {
  const root = await ensureFolder("/me/mailFolders", rootFolderName);

  return ensureFolder(
    `/me/mailFolders/${encodeURIComponent(root.id)}/childFolders`,
    displayName,
  );
}

export async function ensureActiveCaseFolder(
  trackingId: string,
): Promise<MailFolder> {
  const active = await ensureCaseContainer(activeFolderName);

  return ensureFolder(
    `/me/mailFolders/${encodeURIComponent(active.id)}/childFolders`,
    trackingId,
  );
}

export async function getCaseFolderState(
  trackingId: string,
): Promise<CaseFolderState> {
  const [active, archived] = await Promise.all([
    findCaseContainer(activeFolderName),
    findCaseContainer(archivedFolderName),
  ]);
  const [activeCase, archivedCase] = await Promise.all([
    active
      ? findFolder(
          `/me/mailFolders/${encodeURIComponent(active.id)}/childFolders`,
          trackingId,
        )
      : Promise.resolve(null),
    archived
      ? findFolder(
          `/me/mailFolders/${encodeURIComponent(archived.id)}/childFolders`,
          trackingId,
        )
      : Promise.resolve(null),
  ]);

  if (activeCase && archivedCase) {
    throw new Error(
      `Case ${trackingId} exists in both Active and Archived. Resolve the duplicate folders before continuing.`,
    );
  }

  if (activeCase) {
    return { location: "active", folder: activeCase };
  }

  if (archivedCase) {
    return { location: "archived", folder: archivedCase };
  }

  return { location: "untracked", folder: null };
}

export async function moveCaseFolder(
  folderId: string,
  destination: Exclude<CaseLocation, "untracked">,
): Promise<MailFolder> {
  const destinationFolder = await ensureCaseContainer(
    destination === "active" ? activeFolderName : archivedFolderName,
  );

  return graphRequest<MailFolder>(
    `/me/mailFolders/${encodeURIComponent(folderId)}/move`,
    {
      method: "POST",
      body: JSON.stringify({
        destinationId: destinationFolder.id,
      }),
    },
  );
}
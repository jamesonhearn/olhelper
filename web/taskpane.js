let msalApp, account;

const LOG = (m) => {
  const el = document.getElementById("log");
  el.textContent += (typeof m === "string" ? m : JSON.stringify(m, null, 2)) + "\n";
};

async function ensureSignedIn() {
  try {
    const accounts = msalApp.getAllAccounts();
    if (accounts.length) {
      account = accounts[0];
      document.getElementById("userSpan").textContent = account.username;
      return account;
    }
    return null;
  } catch (e) {
    LOG(e);
    return null;
  }
}

async function acquireToken() {
  try {
    const res = await msalApp.acquireTokenSilent({
      account,
      scopes: msalScopes
    });
    return res.accessToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError || e.errorCode === "no_tokens_found") {
      const res = await msalApp.acquireTokenPopup({ scopes: msalScopes });
      account = res.account;
      document.getElementById("userSpan").textContent = account.username;
      return res.accessToken;
    }
    throw e;
  }
}

function getItemBasics() {
  const item = Office.context.mailbox.item;
  const subject = item.subject || "";
  const caseMatch = subject.match(/TrackingID#(\d+)/);
  const caseId = caseMatch ? caseMatch[1] : null;

  // Convert to Graph/REST v2 id if possible (fallback to internetMessageId search).
  let restId = null;
  try {
    restId = Office.context.mailbox.convertToRestId(
      item.itemId,
      Office.MailboxEnums.RestVersion.v2_0
    );
  } catch (e) {
    // ignore, will use internetMessageId
  }

  const internetMessageId = item.internetMessageId || null;
  return { subject, caseId, restId, internetMessageId };
}

async function graphFetch(token, path, init = {}) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText} :: ${body}`);
  }
  return resp.status === 204 ? null : resp.json();
}

// ----- Folder helpers -----

async function getOrCreateChildByName(token, parentId, displayName) {
  // Try filter first; not all tenants allow $filter on mailFolders reliably—fallback to scan.
  let found = await graphFetch(token, `/me/mailFolders/${parentId}/childFolders?$select=id,displayName&$top=100`);
  let hit = found.value.find(f => f.displayName === displayName);
  if (hit) return hit;

  const created = await graphFetch(token, `/me/mailFolders/${parentId}/childFolders`, {
    method: "POST",
    body: JSON.stringify({ displayName })
  });
  return created;
}

async function resolveWellKnown(token, wellKnownName) {
  // well-known folders can be addressed by name
  const f = await graphFetch(token, `/me/mailFolders/${wellKnownName}?$select=id,displayName`);
  return f; // { id, displayName }
}

async function ensurePath(token, names) {
  // Ensure nested path under Inbox by default.
  let current = await resolveWellKnown(token, "inbox");
  for (const name of names) {
    current = await getOrCreateChildByName(token, current.id, name);
  }
  return current; // deepest folder
}

async function findFolderUnder(token, parentId, displayName) {
  const list = await graphFetch(token, `/me/mailFolders/${parentId}/childFolders?$select=id,displayName&$top=100`);
  return list.value.find(f => f.displayName === displayName) || null;
}

async function moveFolder(token, folderId, destinationFolderId) {
  return graphFetch(token, `/me/mailFolders/${folderId}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: destinationFolderId })
  });
}

// ----- Message helpers -----

async function findMessageByInternetMessageId(token, internetMessageId) {
  if (!internetMessageId) return null;
  const q = encodeURIComponent(`internetMessageId eq '${internetMessageId.replace(/'/g, "''")}'`);
  const res = await graphFetch(token, `/me/messages?$select=id,subject,receivedDateTime&$top=1&$filter=${q}`);
  return res.value[0] || null;
}

async function moveMessageById(token, messageId, destinationFolderId) {
  return graphFetch(token, `/me/messages/${messageId}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: destinationFolderId })
  });
}

// ----- UI actions -----

async function fileCurrentMessage() {
  try {
    const token = await acquireToken();
    const { subject, caseId, restId, internetMessageId } = getItemBasics();
    LOG({ subject, caseId, restId, internetMessageId });
    if (!caseId) {
      alert("No TrackingID#<digits> found in subject.");
      return;
    }

    // Ensure folder path: Inbox/Support Cases/Open Cases/<ID>
    const supportCases = await ensurePath(token, ["Support Cases"]);
    const openCases = await getOrCreateChildByName(token, supportCases.id, "Open Cases");
    const caseFolder  = await getOrCreateChildByName(token, openCases.id, caseId);

    // Get a Graph message id
    let msgId = restId;
    if (!msgId) {
      const found = await findMessageByInternetMessageId(token, internetMessageId);
      if (!found) throw new Error("Could not resolve message id in Graph.");
      msgId = found.id;
    }

    // Move message
    await moveMessageById(token, msgId, caseFolder.id);
    alert(`Filed to: Support Cases / Open Cases / ${caseId}`);
  } catch (e) {
    LOG(e.message || e);
    alert("Failed to file message. See log.");
  }
}

async function closeCase() {
  try {
    const token = await acquireToken();
    const caseId = (document.getElementById("closeIdInput").value || "").trim();
    if (!/^\d+$/.test(caseId)) {
      alert("Enter a numeric TrackingID.");
      return;
    }

    // Resolve Support Cases, Open, Closed
    const support = await ensurePath(token, ["Support Cases"]);
    const openF   = await getOrCreateChildByName(token, support.id, "Open Cases");
    const closedF = await getOrCreateChildByName(token, support.id, "Closed Cases");

    // Find the specific case folder under Open
    const caseFolder = await findFolderUnder(token, openF.id, caseId);
    if (!caseFolder) {
      alert(`No folder 'Open Cases/${caseId}' found.`);
      return;
    }

    await moveFolder(token, caseFolder.id, closedF.id);
    alert(`Moved case '${caseId}' to Closed Cases.`);
  } catch (e) {
    LOG(e.message || e);
    alert("Failed to close case. See log.");
  }
}

// ----- bootstrap -----

Office.onReady(async () => {
  msalApp = new msal.PublicClientApplication(msalConfig);

  document.getElementById("signinBtn").onclick = async () => {
    try {
      await msalApp.loginPopup({ scopes: msalScopes });
      account = (msalApp.getAllAccounts() || [])[0];
      document.getElementById("userSpan").textContent = account?.username || "";
      document.getElementById("fileBtn").disabled = false;
      document.getElementById("closeBtn").disabled = false;
    } catch (e) { LOG(e); }
  };

  document.getElementById("fileBtn").onclick  = fileCurrentMessage;
  document.getElementById("closeBtn").onclick = closeCase;

  // Pre-populate subject + TrackingID display
  const { subject, caseId } = getItemBasics();
  document.getElementById("subjectSpan").textContent = subject || "–";
  document.getElementById("caseIdSpan").textContent  = caseId || "–";

  // If already signed-in, enable buttons
  const acc = await ensureSignedIn();
  if (acc) {
    document.getElementById("fileBtn").disabled = false;
    document.getElementById("closeBtn").disabled = false;
  }
});

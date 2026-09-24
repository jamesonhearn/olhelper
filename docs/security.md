# OLHelper security architecture

## Security position

OLHelper is a static Outlook add-in. Outlook loads the application in an Office
WebView, Nested App Authentication (NAA) obtains delegated Microsoft Graph
access for the signed-in user, and the WebView calls Microsoft Graph directly.
Azure Static Web Apps serves HTML, JavaScript, CSS, and images only.

OLHelper has no application backend, database, client secret, managed identity,
app-only Graph permission, or centralized mailbox-data store. The static host
does not receive Graph tokens or Graph responses. Tokens and mailbox data do
enter the hosted JavaScript process, so integrity of the deployed origin and
every runtime dependency is a primary security boundary.

The detailed threat analysis is in [Threat model](threat-model.md).

## Authorization and permission justification

| Permission | Type | Required operations | Why a narrower permission is insufficient |
| --- | --- | --- | --- |
| `MailboxItem.Read.User` | Office add-in resource-specific consent | Read the currently selected item's subject and identifier through Office.js | This permission is selected-item access only. It does not authorize Graph folder, message-move, or rule operations. |
| `Mail.ReadWrite` | Delegated Microsoft Graph | Discover and create the OLHelper folder tree; scan only IDs and subjects from up to 250 recent Inbox messages; move matching messages and case folders | Graph folder creation and message/folder moves require `Mail.ReadWrite`. Graph has no delegated scope limited to a Tracking ID, selected message, or OLHelper folder tree. |
| `MailboxSettings.ReadWrite` | Delegated Microsoft Graph | List, inspect, create, enable, disable, retarget, and delete native Inbox rules | Graph exposes no narrower delegated rule-management permission. |

The Graph scopes are powerful. Client validation and endpoint restrictions
constrain intended OLHelper behavior, but do not reduce the authority encoded in
a stolen token. In particular, they are not a substitute for tenant consent,
assignment, Conditional Access, deployment integrity, or XSS prevention.

There is no documented delegated mailbox-RSC replacement for these operations.
Exchange Online RBAC for Applications is an app-only mailbox-scoping model. It
would require a confidential backend or managed identity, application
authentication, `/users/{mailbox}` Graph calls, and an authoritative check that
the interactive user is allowed to operate on that mailbox. That is a different
architecture rather than a permission-only change.

## Data inventory and minimization

OLHelper processes:

- The selected item's Outlook ID, converted Graph ID, and subject.
- A validated 16–19 digit Tracking ID extracted from the subject.
- Folder names and folder IDs needed to find or manage the case folder.
- Rule summaries, followed by full details only for an exact OLHelper-managed
  rule-name candidate.
- IDs and subjects only for at most the 250 most recent Inbox messages during a
  Track sweep.

OLHelper does not request message bodies, attachments, recipients, sender
details, contacts, calendar data, or mailbox-wide search results. It does not
persist mailbox data in cookies, browser storage, a database, or telemetry.

The following are prohibited in logs, telemetry, URLs, analytics, crash reports,
or support screenshots:

- Access, refresh, or ID tokens and authorization headers.
- Message subjects, bodies, attachments, or recipient/sender data.
- Message, folder, or rule IDs.
- Tracking IDs.
- User email addresses or mailbox identifiers.
- Raw Graph, MSAL, NAA, OneAuth, or broker error payloads.

The UI replaces long or token/broker-like exception text with a generic error.
Azure hosting logs may contain static resource paths, network metadata, and
user-agent information; they must not contain mailbox data.

## Token handling

- MSAL is configured with `BrowserCacheLocation.MemoryStorage`.
- OLHelper never copies a token into `localStorage`, `sessionStorage`,
  IndexedDB, cookies, URLs, application logs, or telemetry.
- A token is attached only by the central Graph client and only to an allowed
  `https://graph.microsoft.com/v1.0` request.
- JavaScript cache state is lost when the WebView process is destroyed. The
  application does not claim that closing a pane immediately clears account or
  token state independently maintained by Outlook, NAA, MSAL, Windows Web
  Account Manager, or another broker.
- Access-token lifetime is controlled by Microsoft Entra ID. OLHelper does not
  request a custom lifetime and does not retain an application timer-based copy.
- Memory-only caching reduces persistence but does not protect a token from
  malicious JavaScript executing in the active OLHelper origin.

## Application-enforced controls

### Mailbox operation boundaries

- The Graph client accepts only the exact endpoint shapes used for OLHelper
  folder, message-move, Inbox-scan, and Inbox-rule operations. It rejects
  `/users`, `/me/drive`, Graph beta, alternate origins, credentials, fragments,
  and other Graph paths.
- Validated absolute Graph v1 pagination links remain subject to the same path
  allowlist.
- Folder, rule, message, and Tracking ID values are URL encoded.
- Inbox scans request only `id,subject`, use deterministic newest-first order,
  and stop after 250 messages.
- Tracking IDs require the canonical `TrackingID#` marker, 16–19 digits, and a
  numeric end boundary.

### User intent and stale-context protection

- Track, Archive, Reopen, and Repair require an in-pane confirmation describing
  the intended mailbox changes.
- The confirmation is bound to a snapshot of the Outlook item ID, converted
  Graph ID, and subject.
- Immediately before mutation, OLHelper revalidates that snapshot.
- The pinnable pane listens for `ItemChanged`; a change cancels confirmation,
  disables every action, reports why, and reloads the pane.
- Action controls start disabled and remain fail-closed if item-change
  protection cannot be registered.

### Managed-rule ownership

OLHelper does not treat a display-name match as ownership. Before modifying or
deleting a candidate rule it verifies the complete managed fingerprint:

- Exact OLHelper-managed display name.
- Rule is writable and Graph reports no rule error.
- Exactly one expected `subjectContains` value.
- No additional configured conditions or exceptions.
- One non-empty move target.
- No forwarding, redirecting, deletion, marking, categorization, or other
  unexpected configured action.
- `stopProcessingRules` is not enabled.

A colliding or user-altered rule is rejected rather than adopted or modified.

### Web and deployment boundary

- CSP defaults all content to the OLHelper origin.
- Network access is limited to the OLHelper origin, Microsoft Graph, and
  Microsoft identity endpoints.
- Scripts are limited to the OLHelper origin and Microsoft-hosted Office.js.
- `object-src`, `base-uri`, and `form-action` are disabled.
- `frame-ancestors` permits only supported Outlook/Office hosts. OLHelper cannot
  use `X-Frame-Options: DENY` because Outlook must embed it.
- Referrers are disabled; HTTPS is enforced with HSTS; MIME sniffing is
  disabled; unnecessary browser capabilities are denied.
- HTML is served with `Cache-Control: no-store`.
- CI uses lockfile installation, production and full dependency audits,
  dependency review, CodeQL, and unified-manifest validation.
- GitHub Actions are pinned to immutable commit SHAs.
- The protected pilot workflow builds once, deploys that `dist` output, and
  publishes the matching unified package plus SHA-256 release hashes.

## Required tenant and operational controls

These controls are deployment requirements; application code cannot enforce
them:

1. Use a single-tenant Entra registration with only the two documented Graph
   delegated scopes.
2. Require assignment on the enterprise application and assign only approved
   pilot or production groups.
3. Grant admin consent only after identity, privacy, and security approval.
   Restrict ordinary user consent and use the admin-consent workflow.
4. Limit app-registration owners, enterprise-app administrators, Static Web App
   contributors, repository administrators, and deployment-environment
   approvers to named accountable owners.
5. Apply Conditional Access appropriate to the user population after report-only
   validation. Do not claim token-protection support for this NAA flow without
   explicit platform confirmation and pilot evidence.
6. Protect the release branch; require current CI, code-owner review, secret
   scanning, and approval on the protected deployment environment.
7. Keep production host origin, tenant ID, and client ID in protected deployment
   configuration. Keep the deployment token secret and rotate it on owner,
   exposure, or incident events.
8. Review assignments, delegated grants, app owners, repository owners, hosting
   roles, and production dependencies on a documented schedule.
9. Retain release commit, workflow run, package, and release hashes for each
   deployment. Promote the reviewed artifact rather than rebuilding from an
   unreviewed source state.

## Security release gates

Before any non-synthetic mailbox pilot or production expansion:

1. Obtain approval for `Mail.ReadWrite` and `MailboxSettings.ReadWrite`, using
   the permission-operation matrix above.
2. Confirm enterprise-app assignment and admin-consent configuration.
3. Confirm the production origin and NAA broker redirect URI are exact and
   controlled.
4. Pass type checking, tests, production/full dependency audits, production
   build, and unified-manifest validation.
5. Confirm deployed CSP and security headers from the production origin.
6. Exercise negative cases: malformed IDs, prefix overlap, renamed rules,
   changed selection after confirmation, partial sweep, Graph throttling, and
   rollback failure.
7. Record primary and backup owners, release approver, grant-review cadence,
   deployment-token rotation, rollback, and enterprise-app disable procedures.
8. Complete required privacy, accessibility, identity, and security reviews.

## Residual risks requiring acceptance

- A delegated `Mail.ReadWrite` token can access more of the signed-in user's
  mailbox than OLHelper intentionally uses. No client-side check narrows that
  OAuth authority.
- Compromise of the static origin, a runtime dependency, an approved release, or
  active WebView JavaScript could expose tokens and mailbox data within the
  delegated scopes.
- Native Exchange `subjectContains` rules are not numeric-boundary-aware. A
  shorter case ID can overlap a longer collaboration ID. Client-side sweeps are
  boundary-safe, but cannot prevent or reverse every native-rule move.
- Graph provides no transaction across folders, messages, and rules. OLHelper
  sequences operations, attempts limited rollback, reports partial success, and
  offers Repair, but rollback is not guaranteed.
- The 250-message Inbox scan is intentionally bounded and may not move older
  matching mail.
- Revocation, assignment removal, and WebView closure may not invalidate every
  already-issued token immediately; containment must include session/token
  revocation according to tenant procedures.

## Emergency containment

1. Disable sign-in to the OLHelper enterprise application or remove all
   assignments.
2. Revoke delegated grants and affected user sessions/tokens according to the
   tenant incident procedure.
3. Remove the OLHelper app package from affected users.
4. Disable the deployment workflow and roll the Static Web App back to a known
   release or replace it with a non-operational holding page.
5. Rotate the Static Web Apps deployment token and review registration,
   repository, workflow, environment, and Azure role changes.
6. Preserve source, release hashes, workflow/Azure/Entra audit records, and
   relevant security events without collecting mailbox content.
7. Identify and disable or remove OLHelper-managed Inbox rules if deployed code
   may have been compromised.
8. Notify privacy, identity, security, and service owners under the applicable
   incident process before restoring service.

# OLHelper pilot security plan

## Security boundary

OLHelper is a static Outlook add-in. It executes in the Office webview and uses
Nested App Authentication (NAA) to obtain delegated Microsoft Graph tokens for
the signed-in user. It has no server-side identity, application permission,
client secret, database, or mailbox-content service.

The pilot uses these delegated permissions:

- `Mail.ReadWrite` to move the selected message.
- `MailboxSettings.ReadWrite` to create folders and Inbox rules.

These permissions are broader than a single case folder. Microsoft Graph does
not provide a permission that limits delegated access to one Tracking ID or
mail folder.

## Data handling

OLHelper reads the selected message subject and Office item ID. During Track it
also reads the IDs and subjects of up to the 250 most recent Inbox messages to
find the complete `TrackingID#<ID>` token. Matching messages are moved directly
through Microsoft Graph. The add-in does not read message bodies, and the static
host does not receive or handle mailbox data.

Do not add any of the following to logs, telemetry, URLs, or crash reports:

- Access, refresh, or ID tokens
- Message subjects or bodies
- Message and folder identifiers
- Tracking IDs
- User email addresses

Azure hosting request logs may contain static resource paths, client network
metadata, and user-agent information. They must not contain mailbox data.

## Threat model

| Threat | Primary mitigation |
| --- | --- |
| A compromised deployment serves mailbox-reading JavaScript | Protected pilot environment, reviewed changes, CodeQL, dependency review, CSP, immutable build output, an environment-controlled exact host origin, and rapid deployment-token rotation |
| A malicious pagination URL receives an access token | Graph client permits only relative Graph paths and absolute `https://graph.microsoft.com/v1.0/` URLs |
| A malformed Tracking ID creates unsafe folders or rules | Canonical `TrackingID#` prefix, 16–19 digit identifier boundary, URL encoding, and negative tests |
| A parent case sweep captures collaboration-task messages | Client-side matching requires the complete `TrackingID#<ID>` token with a numeric end boundary |
| A partial Inbox sweep is mistaken for complete processing | The scan is capped at 250 recent messages and the UI reports discovery failures, move failures, and whether the scan was complete |
| A user triggers unexpected mailbox changes | Every Track, Archive, Reopen, and Repair action requires an in-pane confirmation that identifies the mailbox and describes the mutations |
| A token remains available after the task pane closes | MSAL cache uses `sessionStorage`; tokens are never copied to application storage or telemetry |
| A registration or manifest redirects authentication elsewhere | Single-tenant authority, exact NAA broker origin, controlled manifest, and restricted registration ownership |
| An unapproved site embeds the task pane | CSP `frame-ancestors` permits only the supported Outlook and Office host origins, including `outlook.cloud.microsoft` for new Outlook |
| A vulnerable dependency changes the delivered JavaScript | Lockfile installation, production and full dependency audit gates, patched transitive overrides, Dependabot, dependency review, and CodeQL |
| Support data leaks through monitoring | No application telemetry in the pilot and a prohibition on mailbox identifiers or content in diagnostics |

## Local Testing and Development Guidance

Before using OLHelper with anything other than synthetic sandbox mail:

1. Record the data-flow diagram and review this threat model with the service
   owner.
2. Obtain identity/security approval for both delegated Graph permissions.
3. Confirm the enterprise application requires assignment and assign only the
   pilot user.
4. Enable branch protection, required CI checks, secret scanning, and the
   protected `pilot` GitHub environment.
5. Set the protected `pilot` environment variable `OLHELPER_HOST_ORIGIN` to the
   exact Azure Static Web Apps HTTPS origin. Do not expose it as a workflow
   dispatch input.
6. Confirm the deployed CSP and security headers using browser developer tools
   or `curl.exe -I`.
7. Complete keyboard, screen-reader, high-contrast, and 200% zoom checks.
8. Run the end-to-end acceptance tests in the deployment guide.
9. Record the app owner, backup owner, deployment-token rotation procedure,
   rollback artifact, and enterprise-application disable procedure.

## Known prototype limitations

- The Office add-in development toolchain still includes a moderate-severity
  `adm-zip` advisory involving extraction through destination symlinks. OLHelper
  passes repository-controlled XML manifests rather than untrusted ZIP files,
  the package is excluded from the runtime bundle, and CI rejects high-severity
  advisories across both production and development dependencies. Continue to
  track the upstream package until a patched release is available.
- Graph does not provide transactions across folder, rule, and message
  operations. OLHelper discovers prior Inbox matches before enabling routing,
  sweeps those messages, and moves the selected message last because moving the
  active Outlook item can invalidate the task-pane context. If that final move
  fails, OLHelper attempts to disable a rule that it just enabled. Exact
  partial-success states and Repair routing remain available.
- The pilot now covers Track, status, Archive, Reopen, and Repair routing.
  Automated quota handling and duplicate/conflicting-folder remediation remain
  outside the pilot.
- Exchange `subjectContains` matching is not boundary-aware. Tracking IDs with
  shared prefixes can overlap (for example, a 16-digit parent case and a
  19-digit collaboration task). The Inbox sweep prevents this client-side, but
  native Inbox rules cannot enforce the same numeric end boundary.
- Browser CSP is an additional control, not a substitute for review of every
  JavaScript change delivered from the static origin.

## Emergency containment

1. Disable user sign-in or remove the pilot assignment from the sandbox
   enterprise application.
2. Remove the hosted manifest from the pilot mailbox.
3. Reset the Azure Static Web Apps deployment token.
4. Disable or roll back the deployment workflow.
5. Preserve build, deployment, and Azure activity logs without collecting
   mailbox content.
6. Review and remove OLHelper-managed Inbox rules if the deployed code may have
   been compromised.

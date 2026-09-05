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
mail folder. Approval of this residual scope is a release gate.

## Data handling

OLHelper reads the selected message subject and Office item ID. It sends the
item ID, generated folder names, and generated rule configuration directly to
Microsoft Graph. The static host does not receive these values.

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
| A compromised deployment serves mailbox-reading JavaScript | Protected pilot environment, reviewed changes, CodeQL, dependency review, CSP, immutable build output, and rapid deployment-token rotation |
| A malicious pagination URL receives an access token | Graph client permits only relative Graph paths and absolute `https://graph.microsoft.com/v1.0/` URLs |
| A malformed Tracking ID creates unsafe folders or rules | Allow-listed characters, 64-character limit, URL encoding, and negative tests |
| A user triggers unexpected mailbox changes | Every Track, Archive, Reopen, and Repair action requires an in-pane confirmation that identifies the mailbox and describes the mutations |
| A token remains available after the task pane closes | MSAL cache uses `sessionStorage`; tokens are never copied to application storage or telemetry |
| A registration or manifest redirects authentication elsewhere | Single-tenant authority, exact NAA broker origin, controlled manifest, and restricted registration ownership |
| An unapproved site embeds the task pane | CSP `frame-ancestors` permits only the supported Outlook and Office host origins, including `outlook.cloud.microsoft` for new Outlook |
| A vulnerable dependency changes the delivered JavaScript | Lockfile installation, production dependency audit, Dependabot, dependency review, and CodeQL |
| Support data leaks through monitoring | No application telemetry in the pilot and a prohibition on mailbox identifiers or content in diagnostics |

## Pilot release gates

Before using OLHelper with anything other than synthetic sandbox mail:

1. Record the data-flow diagram and review this threat model with the service
   owner.
2. Obtain identity/security approval for both delegated Graph permissions.
3. Confirm the enterprise application requires assignment and assign only the
   pilot user.
4. Enable branch protection, required CI checks, secret scanning, and the
   protected `pilot` GitHub environment.
5. Confirm the deployed CSP and security headers using browser developer tools
   or `curl.exe -I`.
6. Complete keyboard, screen-reader, high-contrast, and 200% zoom checks.
7. Run the end-to-end acceptance tests in the deployment guide.
8. Record the app owner, backup owner, deployment-token rotation procedure,
   rollback artifact, and enterprise-application disable procedure.

## Known prototype limitations

- The Office add-in development toolchain currently reports transitive
  vulnerabilities. They are excluded from the runtime bundle, and the CI
  security gate separately verifies production dependencies. They must still
  be tracked and remediated or formally dispositioned before production.
- Graph does not provide transactions across folder, rule, and message
  operations. OLHelper orders operations to keep routing disabled until the
  selected message is moved, reports exact partial-success states, and provides
  Repair routing. A failed operation can still leave a reusable folder or a
  disabled rule.
- The pilot now covers Track, status, Archive, Reopen, and Repair routing.
  Automated quota handling and duplicate/conflicting-folder remediation remain
  outside the pilot.
- Exchange `subjectContains` matching is not boundary-aware. Tracking IDs with
  shared prefixes can overlap (for example, `ABC` and `ABC-2`). Production use
  requires a canonical delimiter or fixed-length identifier format.
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

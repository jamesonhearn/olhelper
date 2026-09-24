# OLHelper

OLHelper is an Outlook task-pane add-in that uses delegated Microsoft Graph
permissions to manage support-case folders, native Inbox rules, and selected
messages. The pilot supports a complete case lifecycle:

- **Track** creates or reuses an active case folder, moves the selected message,
  enables persistent routing, and sweeps matching messages from the 250 most
  recent Inbox messages.
- **Check status** reports whether the case is active, archived, untracked, or
  requires routing repair.
- **Archive** disables routing, moves the case folder to `Archived`, and removes
  the OLHelper-managed rule.
- **Reopen** moves an archived case back to `Active` and restores routing.
- **Repair routing** recreates or enables the managed rule for an active case.

The pilot has no backend service, client secret, application-level mailbox
access, or centralized storage of mailbox content.

Case folders may be renamed with space-delimited context after the Tracking ID,
for example `1234567890123456 - Contoso`. OLHelper rejects ambiguous matches
rather than choosing between multiple folders for the same Tracking ID.

## Configuration responsibilities

- `package.json` declares the browser/runtime dependencies and the commands used
  to build, validate, serve, and sideload the add-in.
- `appPackage/manifest.json` is the unified Microsoft 365 manifest that tells
  Outlook when and where to display OLHelper. Its local URLs point to the
  Webpack HTTPS server at `https://localhost:3000`; local and pilot package
  generation inject the matching Entra client ID.
- `webpack.config.js` compiles the TypeScript and CSS in `src/`, creates the
  task-pane and command HTML pages, copies icons, injects Entra identifiers, and
  serves the resulting files over trusted local HTTPS.
- `.env.local` contains the sandbox Entra application and tenant IDs used by
  Webpack. It is intentionally excluded from Git. These identifiers are not
  client secrets, but are excluded to ensure a fully PII-stripped public repo.

## Locally Hosted Sandbox Entra Application Testing

Register a single-tenant SPA in the Microsoft 365 developer sandbox:

1. Add the SPA redirect URI `brk-multihub://localhost:3000`.
2. Add delegated Microsoft Graph permissions:
   - `Mail.ReadWrite`
   - `MailboxSettings.ReadWrite`
3. Copy `.env.example` to `.env.local` and replace both placeholder IDs.

## Local commands

```powershell
npm install
npm run typecheck
npm run build
npm run validate
npm start
```

`npm start` creates `appPackage/build/olhelper-local.zip`, starts the HTTPS
development server, and attempts to sideload the unified package into Outlook.
Use `npm run stop` to stop the debugging session.
For manual sideloading, create and upload the local package first, then run only
the local server:

```powershell
npm run manifest:local
# Upload appPackage/build/olhelper-local.zip through the Teams app store.
npm run dev-server
```

The generated files are written to `dist/`. Do not edit that directory.

## Local and production URLs

The checked-in manifest is a locally valid template with a placeholder Entra
client ID. `npm run manifest:local` reads the real ID from `.env.local`. For
organizational deployment, every `https://localhost:3000` URL is replaced with
the approved static hosting origin and the protected environment supplies the
Entra client ID. The registration must include this trusted-broker redirect:

```text
brk-multihub://<production-origin>
```

The broker redirect contains only the origin, without a path.

## Azure Hosted Pilot

The Azure-hosted pilot runs in an Azure subscription associated with a
different tenant from the M365 developer sandbox. Azure hosts the static files,
the sandbox app registration controls NAA identity and delegated Graph access.

See:

- [Azure Static Web Apps pilot deployment](docs/deploy-azure-static-web-apps.md)
- [Security architecture and release gates](docs/security.md)
- [Threat model and Graph permission justification](docs/threat-model.md)

The deployment workflow generates
`appPackage/build/olhelper-pilot.zip` for the protected HTTPS origin. The ZIP
contains the generated `manifest.json` and required 32×32 outline and 192×192
color icons; executable add-in assets remain in Azure Static Web Apps.

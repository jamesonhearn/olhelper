# OLHelper

OLHelper is an Outlook task-pane add-in that uses delegated Microsoft Graph
permissions to create support-case folders, install native Inbox rules, and move
selected messages. The prototype has no backend service, client secret, or
application-level mailbox access.

## Configuration responsibilities

- `package.json` declares the browser/runtime dependencies and the commands used
  to build, validate, serve, and sideload the add-in.
- `manifest.xml` tells Outlook when and where to display OLHelper. All local
  URLs point to the Webpack HTTPS server at `https://localhost:3000`.
- `webpack.config.js` compiles the TypeScript and CSS in `src/`, creates the
  task-pane and command HTML pages, copies icons, injects Entra identifiers, and
  serves the resulting files over trusted local HTTPS.
- `.env.local` contains the sandbox Entra application and tenant IDs used by
  Webpack. It is intentionally excluded from Git. These identifiers are not
  client secrets, and the add-in must not have a client secret.

## Sandbox Entra application

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

`npm start` starts the HTTPS development server and attempts to sideload
`manifest.xml` into Outlook. Use `npm run stop` to stop the debugging session.
To run only the local server for manual sideloading, use:

```powershell
npm run dev-server
```

The generated files are written to `dist/`. Do not edit that directory.

## Local and production URLs

The checked-in manifest is intentionally configured only for the local pilot.
Before organizational deployment, replace every `https://localhost:3000` URL
with the approved static hosting origin and add the production trusted-broker
redirect URI to the Entra application:

```text
brk-multihub://<production-origin>
```

The broker redirect contains only the origin, without a path.

## Hosted single-user pilot

The Azure-hosted pilot can run in an Azure subscription associated with a
different tenant from the M365 developer sandbox. Azure hosts static files;
the sandbox app registration controls NAA identity and delegated Graph access.

See:

- [Azure Static Web Apps pilot deployment](docs/deploy-azure-static-web-apps.md)
- [Pilot security plan and release gates](docs/security.md)

The deployment workflow generates `dist/manifest.pilot.xml` for the supplied
HTTPS origin. The checked-in `manifest.xml` remains localhost-only.

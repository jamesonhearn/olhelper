# Deploy the OLHelper single-user pilot

This deployment hosts OLHelper in an Azure subscription while keeping identity
and Microsoft Graph consent in the separate Microsoft 365 developer sandbox
tenant. Static hosting and runtime identity do not need to share a tenant.

## Resulting layout

```text
Outlook sandbox user
  -> hosted OLHelper manifest
  -> Azure Static Web Apps HTTPS origin
  -> NAA app registration in the M365 sandbox tenant
  -> delegated Microsoft Graph /me
  -> sandbox user's Exchange Online mailbox
```

The static files are publicly retrievable. Never place a secret, deployment
token, mailbox identifier, or confidential configuration in the bundle.
The Entra client ID and tenant ID are public identifiers.

## 1. Create the Azure host

Install or update Azure CLI and its Static Web Apps extension, authenticate to
the Azure subscription that will pay for hosting, and select it explicitly:

```powershell
az login
az account set --subscription "<azure-subscription-id-or-name>"
az extension add --name staticwebapp --upgrade
```

Choose globally unique names and an approved Azure region:

```powershell
$resourceGroup = "rg-olhelper-pilot"
$staticWebAppName = "olhelper-pilot-<unique-suffix>"
$location = "centralus"

az group create `
  --name $resourceGroup `
  --location $location

$hostName = az staticwebapp create `
  --name $staticWebAppName `
  --resource-group $resourceGroup `
  --location $location `
  --sku Standard `
  --query defaultHostname `
  --output tsv

$hostOrigin = "https://$hostName"
$hostOrigin
```

Do not pass `--source` for this deployment model. The parameter is optional,
but when present Azure CLI validates it as a GitHub repository URL. OLHelper
uses the repository's protected `deploy-pilot.yml` workflow and the Static Web
Apps deployment token instead of asking `az staticwebapp create` to generate a
second repository-linked workflow.

If you intentionally want Azure CLI to link the Static Web App directly to the
GitHub repository instead, use the repository URL and branch:

```powershell
az staticwebapp create `
  --name $staticWebAppName `
  --resource-group $resourceGroup `
  --source "https://github.com/jamesonhearn/olhelper" `
  --branch "main" `
  --location $location `
  --sku Standard `
  --login-with-github
```

Do not use that repository-linked command together with OLHelper's manual
deployment-token workflow unless you deliberately consolidate the generated
Azure workflow and `.github\workflows\deploy-pilot.yml`.

The Standard SKU is production-shaped but billable. The Free SKU can be used
for an initial sandbox validation if its current limits are acceptable.

## 2. Configure GitHub deployment controls

Create a GitHub environment named `pilot`. Add:

| Type | Name | Value |
| --- | --- | --- |
| Environment variable | `OLHELPER_CLIENT_ID` | Sandbox app registration client ID |
| Environment variable | `OLHELPER_TENANT_ID` | Sandbox tenant ID |
| Environment secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static Web Apps deployment token |

Retrieve the token without adding it to a file or repository:

```powershell
az staticwebapp secrets list `
  --name $staticWebAppName `
  --resource-group $resourceGroup `
  --query properties.apiKey `
  --output tsv
```

Copy the result directly into the GitHub environment secret. Configure a
required reviewer for the environment if the repository plan supports it.
Reset the token immediately if it is exposed:

```powershell
az staticwebapp secrets reset-api-key `
  --name $staticWebAppName `
  --resource-group $resourceGroup
```

## 3. Configure the sandbox app registration

In the M365 sandbox tenant:

1. Keep the registration single-tenant.
2. Add the **SPA** redirect URI:

   ```text
   brk-multihub://<the-default-hostname>
   ```

   For `https://olhelper.example.azurestaticapps.net`, the redirect is
   `brk-multihub://olhelper.example.azurestaticapps.net`. Do not include a path
   or trailing slash.
3. Retain only delegated `Mail.ReadWrite` and
   `MailboxSettings.ReadWrite`.
4. Do not create a client secret or certificate.
5. In the enterprise application, enable **Assignment required** and assign
   only the sandbox pilot user.
6. Restrict app-registration owners to the named owner and backup owner.

The Azure hosting tenant does not need a corresponding enterprise application.

## 4. Deploy

Push the reviewed changes to GitHub. In **Actions**, run **Deploy OLHelper
pilot** and provide:

```text
https://<the-default-hostname>
```

The workflow installs from the lockfile, type-checks, tests, audits runtime
dependencies, builds the static assets, generates a hosted manifest, validates
it, deploys `dist`, and publishes the manifest as a workflow artifact.

Download the `olhelper-pilot-manifest` artifact and use
`manifest.pilot.xml` for sideloading. Do not sideload the checked-in
`manifest.xml`; it intentionally points to localhost.

The deployment artifact includes a minimal `index.html` because Azure Static
Web Apps requires a default document at the artifact root. Outlook does not use
that page for the add-in; the manifest opens `taskpane.html` and
`commands.html`.

## How Outlook authenticates to the sandbox registration

The XML manifest identifies the hosted task-pane URL, not the Entra
registration. Webpack embeds the public sandbox application client ID and
tenant ID into the hosted JavaScript at build time from the protected GitHub
environment variables.

Authentication begins only when a mailbox operation requests a Graph token:

1. `auth.ts` initializes MSAL with the embedded client ID and the sandbox
   tenant-specific authority.
2. `createNestablePublicClientApplication` asks the Office host to broker the
   currently signed-in Office identity.
3. Entra validates that the hosted origin matches the registration's SPA
   redirect `brk-multihub://<host>`.
4. Entra evaluates the sandbox user's assignment, delegated permissions,
   consent, Conditional Access, and sign-in requirements.
5. If consent and a valid session already exist, token acquisition can be
   silent. Otherwise, Outlook displays Microsoft's sign-in/consent experience
   showing the app registration display name and requested permissions.
6. MSAL returns a short-lived delegated token to the task pane, and OLHelper
   sends it directly to Microsoft Graph for `/me` operations.

The Azure Static Web Apps subscription does not authenticate the Outlook user
and does not receive the Graph token. Its only role is serving the static
files. Do not configure Static Web Apps built-in authentication for this
pilot; it is separate from Office NAA and is not needed.

## 5. Validate the deployed boundary

Confirm availability and response headers:

```powershell
curl.exe -I "$hostOrigin/taskpane.html"
curl.exe -I "$hostOrigin/staticwebapp.config.json"
```

The task pane response should include CSP, HSTS, `nosniff`, no-referrer, and
permissions-policy headers. `staticwebapp.config.json` may be retrievable and
contains no secret.

Perform the pilot with two sandbox users:

1. Sign in to Outlook as the assigned pilot user.
2. Open a synthetic message containing `TrackingID#OLH-1001`.
3. Open OLHelper and verify the confirmation names the expected mailbox and
   operations.
4. Cancel once and confirm that no folder, rule, or move occurs.
5. Confirm Track and verify `Support Cases\Active\OLH-1001`, the enabled
   managed Inbox rule, and movement of the selected message.
6. Select **Check case status** and verify the case reports Active with routing
   enabled.
7. Close Outlook and send another matching message from the second sandbox
   user.
8. Verify Exchange routes it while OLHelper is not running.
9. Open a case message, select **Archive case**, and verify the folder moves to
   `Support Cases\Archived\OLH-1001` and the managed rule is removed.
10. Send another matching message and verify it remains in the Inbox.
11. Open the archived message, select **Reopen case**, and verify the folder
    returns to `Active` and routing is restored.
12. Disable the managed rule in Outlook, use **Check case status**, then select
    **Repair routing** and verify the rule is enabled.
13. Attempt sign-in with an unassigned sandbox user and confirm access is
   blocked.
14. Inspect browser network activity and confirm Graph calls go only to
   `graph.microsoft.com`.

## 6. Roll back or remove the pilot

For a code regression, redeploy the previous reviewed build. For a suspected
security issue, follow `docs/security.md` and disable the enterprise
application assignment before investigating.

After testing, remove the sideloaded manifest. Delete Azure resources only
after confirming that logs or evidence required for the review have been
retained according to the applicable policy.

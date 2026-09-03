import {
  createNestablePublicClientApplication,
  InteractionRequiredAuthError,
  type IPublicClientApplication,
} from "@azure/msal-browser";

declare const process: {
  env: {
    OLHELPER_CLIENT_ID?: string;
    OLHELPER_TENANT_ID?: string;
  };
};

const scopes = [
  "Mail.ReadWrite",
  "MailboxSettings.ReadWrite",
];

let msal: IPublicClientApplication | undefined;

async function getMsal(): Promise<IPublicClientApplication> {
  if (!msal) {
    const clientId = process.env.OLHELPER_CLIENT_ID;
    const tenantId = process.env.OLHELPER_TENANT_ID;

    if (!clientId || !tenantId) {
      throw new Error(
        "OLHelper authentication is not configured. Set OLHELPER_CLIENT_ID and OLHELPER_TENANT_ID in .env.local.",
      );
    }

    msal = await createNestablePublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
      cache: {
        cacheLocation: "sessionStorage",
      },
    });
  }

  return msal;
}

export async function getGraphToken(): Promise<string> {
  const instance = await getMsal();
  const request = { scopes };

  try {
    const result = await instance.acquireTokenSilent(request);
    return result.accessToken;
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) {
      throw error;
    }

    const result = await instance.acquireTokenPopup(request);
    return result.accessToken;
  }
}

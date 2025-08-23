// TODO: fill in your Entra app registration details
const msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID", // e.g., 00000000-0000-0000-0000-000000000000
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID_OR_NAME", //replace
    redirectUri: "https://YOUR_HOST/web/auth.html" //replace
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

const msalScopes = ["https://graph.microsoft.com/Mail.ReadWrite"];

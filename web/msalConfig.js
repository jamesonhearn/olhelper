// TODO: fill in your Entra app registration details
const msalConfig = {
  auth: {
    clientId: "17d1755f-2fe3-482a-ad96-9867c75e8146", // e.g., 00000000-0000-0000-0000-000000000000
    authority: "https://login.microsoftonline.com/", //replace
    redirectUri: "https://red-wave-057987a0f.2.azurestaticapps.net/auth.html" //replace
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

const msalScopes = ["https://graph.microsoft.com/Mail.ReadWrite"];

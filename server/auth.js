const express = require('express');
const axios = require('axios');

const CLIENT_ID = "client-id";
const CLIENT_SECRET = "client-secret";
const TENANT_ID = "tenant-id";
const REDIRECT_URI = "https:/olhelper-fdavdcg2fza6gcax.canadacentral-01.azurewebsites.net/auth/callback";

const router = express.Router();

// Redirect user to OAuth login
router.get('/login', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=Mail.ReadWrite MailboxSettings.ReadWrite offline_access&state=12345`;
    res.redirect(authUrl);
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const response = await axios.post(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, null, {
            params: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                redirect_uri: REDIRECT_URI,
                code
            },
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        res.json({ access_token: response.data.access_token });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Authentication failed");
    }
});

module.exports = router;

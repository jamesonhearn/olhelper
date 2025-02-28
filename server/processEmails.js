const express = require('express');
const axios = require('axios');
const router = express.Router();

// Extract Tracking ID
function extractTrackingID(subject) {
    const match = subject.match(/TrackingID#(\d+)/);
    return match ? match[1] : null;
}

// Process emails
router.get('/process-emails', async (req, res) => {
    const accessToken = req.headers.authorization.split(" ")[1];

    try {
        const messages = await axios.get("https://graph.microsoft.com/v1.0/me/messages", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        for (let email of messages.data.value) {
            let trackingNumber = extractTrackingID(email.subject);
            if (trackingNumber) {
                await moveEmailToFolder(email.id, trackingNumber, accessToken);
            }
        }

        res.json({ message: "Emails organized successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error processing emails" });
    }
});

async function moveEmailToFolder(messageId, folderName, accessToken) {
    let folderId = await checkOrCreateFolder(folderName, accessToken);

    await axios.post(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, {
        destinationId: folderId
    }, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
}

async function checkOrCreateFolder(folderName, accessToken) {
    const folders = await axios.get("https://graph.microsoft.com/v1.0/me/mailFolders", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    let folder = folders.data.value.find(f => f.displayName === folderName);
    if (!folder) {
        const newFolder = await axios.post("https://graph.microsoft.com/v1.0/me/mailFolders", {
            displayName: folderName
        }, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return newFolder.data.id;
    }
    return folder.id;
}

module.exports = router;

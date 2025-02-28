async function authenticateUser() {
    document.getElementById("status").innerText = "Redirecting to Microsoft login...";
    window.location.href = "https://olhelper-fdavdcg2fza6gcax.canadacentral-01.azurewebsites.net/login";
}

async function processEmails() {
    document.getElementById("result").innerText = "Processing emails...";

    try {
        const response = await fetch("https://olhelper-fdavdcg2fza6gcax.canadacentral-01.azurewebsites.net/process-emails");
        const result = await response.json();

        document.getElementById("result").innerText = result.message || "Emails organized!";
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("result").innerText = "Error processing emails.";
    }
}


const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const config = require("./config");

async function getToken() {
  const response = await axios.post(`https://${config.domain}/oauth/token`, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    audience: `https://${config.domain}/api/v2/`,
    grant_type: "client_credentials"
  });
  return response.data.access_token;
}

async function runMigration() {
  try {
    const token = await getToken();
    const fileStream = fs.createReadStream("./users.json");

    const formData = new FormData();
    formData.append("users", fileStream);
    formData.append("connection_id", config.connectionId);
    formData.append("upsert", "true");

    const response = await axios.post(
      `https://${config.domain}/api/v2/jobs/users-imports`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );

    console.log("Migration Job Created:", response.data);
  } catch (err) {
    console.error("Migration failed:", err.response?.data || err.message);
    process.exit(1);
  }
}

runMigration();

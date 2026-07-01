exports.onExecutePostLogin = async (event, api) => {
  const axios = require("axios");

  try {
    const apiKey = event.secrets.SMP_API_KEY;

    const email = event.user.email;
    const phone = event.user.phone_number;

    const response = await axios.get(
      "https://6a3ce682d8e212699e2302dd.mockapi.io/SMP",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = response.data;

    // ✅ Match user manually (since mock API likely returns full list)
    const smpUser = data.find(
      user => user.email === email || user.phone === phone
    );

    if (smpUser) {

      // ✅ Store safe fields only
      api.user.setAppMetadata("smp_id", smpUser.id);
      api.user.setAppMetadata("smp_name", smpUser.name);

      // ✅ Send data to frontend
      api.idToken.setCustomClaim(
        "https://yourapp.com/smp_user",
        smpUser
      );

    } else {
      console.log("No SMP user found");
    }

  } catch (error) {
    console.log("❌ SMP API failed:", error.response?.data || error.message);
  }
};
exports.onExecutePostLogin = async (event, api) => {
  try {
    const apiKey = event.secrets.SMP_API_KEY;

    const email = event.user.email;
    const phone = event.user.phone_number;

    const response = await fetch(
      "https://6a3ce682d8e212699e2302dd.mockapi.io/SMP",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    // ✅ Handle HTTP errors
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // ✅ Safe check if API returns array
    if (!Array.isArray(data)) {
      console.log("Unexpected API response format");
      return;
    }

    const smpUser = data.find(
      user => user.email === email || user.phone === phone
    );

    if (smpUser) {
      // ✅ Store safe metadata
      api.user.setAppMetadata("smp_id", smpUser.id);
      api.user.setAppMetadata("smp_name", smpUser.name);

      // ✅ Send only required fields (avoid sending full object if sensitive)
      api.idToken.setCustomClaim(
        "https://yourapp.com/smp_user",
        {
          id: smpUser.id,
          name: smpUser.name,
          email: smpUser.email
        }
      );

    } else {
      console.log("No SMP user found");
    }

  } catch (error) {
    console.log("❌ SMP API failed:", error.message);
  }
};
/**
 * Post-Login Action: 
 * 1. Auto-link Passwordless Email OTP identity to existing DB user
 * 2. Fetch SMP profile and attach to ID token
 *
 * Requires secrets:
 *  - MGMT_API_DOMAIN
 *  - MGMT_API_CLIENT_ID
 *  - MGMT_API_CLIENT_SECRET
 *  - SMP_API_KEY
 */

exports.onExecutePostLogin = async (event, api) => {
  console.log("🚀 Action Started");

  // Run ONLY for passwordless email logins
  if (!event?.connection?.strategy || event.connection.strategy !== "email") {
    console.log("⏭️ Skipping: Not a passwordless email login");
    return;
  }

  const email = event?.user?.email;
  const phone = event?.user?.phone_number;
  const emailVerified = event?.user?.email_verified;

  console.log("🔍 User Info:", { email, phone, emailVerified });

  if (!email || !emailVerified) {
    console.log("⏭️ Skipping: Email missing or not verified");
    return;
  }

  const domain = event.secrets.MGMT_API_DOMAIN;
  const clientId = event.secrets.MGMT_API_CLIENT_ID;
  const clientSecret = event.secrets.MGMT_API_CLIENT_SECRET;

  // Helper for HTTP calls
  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  };

  let primary = null;

  try {
    console.log("🔑 Fetching Management API Token");

    // -------------------------------
    // 1) Get Management API Token
    // -------------------------------
    const tokenResp = await fetchJson(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
      }),
    });

    const mgmtToken = tokenResp.access_token;
    if (!mgmtToken) {
      console.log("❌ Failed to get Management API token");
      return;
    }

    console.log("✅ Got Management API Token");

    const headers = {
      Authorization: `Bearer ${mgmtToken}`,
      "content-type": "application/json",
    };

    // -------------------------------
    // 2) Find users by email
    // -------------------------------
    console.log("🔍 Searching users by email:", email);

    const users = await fetchJson(
      `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers }
    );

    console.log("👥 Users found:", users.length);

    if (!Array.isArray(users) || users.length < 2) {
      console.log("⏭️ Skipping linking: Not enough users");
      return;
    }

    const currentUserId = event.user.user_id;

    // -------------------------------
    // 3) Select primary (DB user)
    // -------------------------------
    primary = users.find(u =>
      u.user_id !== currentUserId &&
      Array.isArray(u.identities) &&
      u.identities.some(id => id.provider === "auth0")
    );

    if (!primary) {
      console.log("⏭️ No primary DB user found");
      return;
    }

    console.log("✅ Primary user selected:", primary.user_id);

    const alreadyLinked =
      Array.isArray(primary.identities) &&
      primary.identities.some(id => id.provider === "email");

    if (!alreadyLinked) {
      console.log("🔗 Linking passwordless identity");

      const secondaryRawUserId = currentUserId.startsWith("email|")
        ? currentUserId.split("|")[1]
        : currentUserId;

      if (secondaryRawUserId) {
        await fetchJson(
          `https://${domain}/api/v2/users/${encodeURIComponent(primary.user_id)}/identities`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              provider: "email",
              user_id: secondaryRawUserId,
            }),
          }
        );

        console.log("✅ Identity linked successfully");
      }
    } else {
      console.log("ℹ️ Identity already linked");
    }

    // ✅ Switch session to primary user
    console.log("🔄 Switching session to primary user");
    api.authentication.setPrimaryUser(primary.user_id);

  } catch (err) {
    console.log("❌ Account linking failed:", err.message);
  }

  // -------------------------------
  // 4) SMP API Call (WITH LOGS ✅)
  // -------------------------------
  try {
    console.log("🌐 SMP Lookup Started");

    const useMock = true; // ✅ KEEP TRUE while using dummy API key

    let smpUser;

    if (useMock) {
      smpUser = {
        id: "smp_mock_001",
        email: email,
        phone: phone,
        status: "mock-user"
      };

      console.log("✅ Using MOCK SMP user:", smpUser);

    } else {
      console.log("📡 Calling SMP API...");

      const smpResponse = await fetch(
        `https://SMP_API/users?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone || '')}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${event.secrets.SMP_API_KEY}`
          }
        }
      );

      const smpText = await smpResponse.text();
      console.log("📨 SMP Raw Response:", smpText);

      if (smpResponse.ok && smpText) {
        smpUser = JSON.parse(smpText);
        console.log("✅ SMP API Success:", smpUser);
      } else {
        console.log("⚠️ SMP lookup failed:", smpText);
        return;
      }
    }

    // ✅ Attach SMP data to token
    api.idToken.setCustomClaim("https://smp/user", smpUser);
    console.log("✅ SMP data added to token");

  } catch (err) {
    console.log("❌ SMP lookup error:", err.message);
  }

  console.log("✅ Action Completed");
};
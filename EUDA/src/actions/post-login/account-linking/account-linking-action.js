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
  // Run ONLY for passwordless email logins
  if (!event?.connection?.strategy || event.connection.strategy !== "email") {
    return;
  }

  const email = event?.user?.email;
  const phone = event?.user?.phone_number;
  const emailVerified = event?.user?.email_verified;

  if (!email || !emailVerified) {
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
    if (!mgmtToken) return;

    const headers = {
      Authorization: `Bearer ${mgmtToken}`,
      "content-type": "application/json",
    };

    // -------------------------------
    // 2) Find users by email
    // -------------------------------
    const users = await fetchJson(
      `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { method: "GET", headers }
    );

    if (!Array.isArray(users) || users.length < 2) {
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

    if (!primary) return;

    const alreadyLinked =
      Array.isArray(primary.identities) &&
      primary.identities.some(id => id.provider === "email");

    if (!alreadyLinked) {
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
      }
    }

    // ✅ Switch session to primary user
    api.authentication.setPrimaryUser(primary.user_id);

  } catch (err) {
    console.log("Account linking failed:", err.message);
  }

  // -------------------------------
  // 4) SMP API Call (NEW)
  // -------------------------------
  try {
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
    if (smpResponse.ok && smpText) {
      const smpUser = JSON.parse(smpText);

      // ✅ Attach SMP data to token
      api.idToken.setCustomClaim("https://smp/user", smpUser);
    } else {
      console.log("SMP lookup failed:", smpText);
    }

  } catch (err) {
    console.log("SMP lookup error:", err.message);
  }

};

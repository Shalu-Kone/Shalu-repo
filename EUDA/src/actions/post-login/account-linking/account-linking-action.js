/**
 * Post-Login Action: Auto-link Passwordless Email OTP identity to existing DB (auth0) user.
 *
 * Requires secrets:
 *  - AUTH0_DOMAIN
 *  - M2M_CLIENT_ID
 *  - M2M_CLIENT_SECRET
 *
 * M2M scopes:
 *  - read:users
 *  - update:users
 */
exports.onExecutePostLogin = async (event, api) => {
  // Run ONLY for passwordless email logins (strategy is typically "email")
  if (!event?.connection?.strategy || event.connection.strategy !== "email") {
    return;
  }

  // Require email + verified (OTP flow should verify email, but keep this check)
  const email = event?.user?.email;
  const emailVerified = event?.user?.email_verified;
  if (!email || !emailVerified) {
    return;
  }

  const domain = event.secrets.MGMT_API_DOMAIN;
  const clientId = event.secrets.MGMT_API_CLIENT_ID;
  const clientSecret = event.secrets.MGMT_API_CLIENT_SECRET;

  // Helper: call Auth0 Management API
  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    return text ? JSON.parse(text) : {};
  };

  // 1) Get Management API token (client credentials)
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

  const authzHeaders = {
    Authorization: `Bearer ${mgmtToken}`,
    "content-type": "application/json",
  };

  // 2) Find all users with same email
  // /users-by-email is commonly used for exact email matching
  const users = await fetchJson(
    `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
    { method: "GET", headers: authzHeaders }
  );

  if (!Array.isArray(users) || users.length < 2) {
    // Nothing to link user (only one user exists)
    return;
  }

  const currentUserId = event.user.user_id; // likely "email|xxxx"
  const current = users.find(u => u.user_id === currentUserId) || event.user;

  // 3) Choose PRIMARY as the migrated DB user (provider "auth0")
  // Adjust logic if your DB connection/provider differs.
  const primary = users.find(u =>
    u.user_id !== currentUserId &&
    Array.isArray(u.identities) &&
    u.identities.some(id => id.provider === "auth0")
  );

  if (!primary) {
    // No DB user found to link into
    return;
  }

  // Avoid linking if already linked (primary already has an "email" identity)
  const alreadyLinked = Array.isArray(primary.identities) &&
    primary.identities.some(id => id.provider === "email");

  if (alreadyLinked) {
    // Ensure session continues as primary if needed
    api.authentication.setPrimaryUser(primary.user_id);
    return;
  }

  // 4) Link SECONDARY (passwordless email identity) into PRIMARY using Management API
  // Endpoint: POST /api/v2/users/{PRIMARY}/identities
  // Body must include provider + user_id (user_id WITHOUT "provider|" prefix)
  const secondaryProvider = "email";
  const secondaryRawUserId = (currentUserId || "").startsWith("email|")
    ? currentUserId.split("|")[1]
    : (currentUserId || "");

  if (!secondaryRawUserId) return;

  await fetchJson(`https://${domain}/api/v2/users/${encodeURIComponent(primary.user_id)}/identities`, {
    method: "POST",
    headers: authzHeaders,
    body: JSON.stringify({
      provider: secondaryProvider,
      user_id: secondaryRawUserId,
      // connection_id: "OPTIONAL" (used mainly for auth0 DB provider disambiguation)
    }),
  });

  // 5) IMPORTANT: switch the login context to the PRIMARY user, otherwise login may break
  api.authentication.setPrimaryUser(primary.user_id);

  // Optional: add a claim for debugging / front-end visibility
  //api.idToken.setCustomClaim("https://example.com/account_linked", true);
  //api.idToken.setCustomClaim("https://example.com/primary_user_id", primary.user_id);
};
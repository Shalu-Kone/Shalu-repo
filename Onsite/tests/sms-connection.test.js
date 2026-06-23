const fs = require('fs');
const path = require('path');

const SMS_CONFIG_PATH = path.join(__dirname, '..', 'connections', 'sms.json');

describe('SMS Connection Configuration', () => {
  let smsConfig;

  beforeAll(() => {
    const raw = fs.readFileSync(SMS_CONFIG_PATH, 'utf8');
    smsConfig = JSON.parse(raw);
  });

  test('sms.json exists and is valid JSON', () => {
    expect(smsConfig).toBeDefined();
  });

  test('connection name is "sms"', () => {
    expect(smsConfig.name).toBe('sms');
  });

  test('strategy is "sms"', () => {
    expect(smsConfig.strategy).toBe('sms');
  });

  test('enabled_clients is an array', () => {
    expect(Array.isArray(smsConfig.enabled_clients)).toBe(true);
  });

  test('options block is present', () => {
    expect(smsConfig.options).toBeDefined();
  });

  test('OTP template contains the @@password@@ placeholder', () => {
    expect(smsConfig.options.template).toContain('@@password@@');
  });

  test('TOTP time_step is a positive number', () => {
    expect(smsConfig.options.totp.time_step).toBeGreaterThan(0);
  });

  test('TOTP length is 6', () => {
    expect(smsConfig.options.totp.length).toBe(6);
  });

  test('brute_force_protection is enabled', () => {
    expect(smsConfig.options.brute_force_protection).toBe(true);
  });

  test('twilio_sid placeholder is set', () => {
    expect(smsConfig.options.twilio_sid).toBeTruthy();
  });

  test('twilio_token placeholder is set', () => {
    expect(smsConfig.options.twilio_token).toBeTruthy();
  });

  test('from placeholder is set', () => {
    expect(smsConfig.options.from).toBeTruthy();
  });
});

describe('SMS Connection – Live API Check', () => {
  const {
    AUTH0_DOMAIN,
    AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET,
  } = process.env;

  const hasCredentials = AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_CLIENT_SECRET;

  (hasCredentials ? test : test.skip)(
    'SMS connection exists and is enabled in Auth0 tenant',
    async () => {
      // Obtain a Management API token using client credentials
      const tokenRes = await fetch(
        `https://${AUTH0_DOMAIN}/oauth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: AUTH0_CLIENT_ID,
            client_secret: AUTH0_CLIENT_SECRET,
            audience: `https://${AUTH0_DOMAIN}/api/v2/`,
          }),
        },
      );

      expect(tokenRes.ok).toBe(true);
      const { access_token: token } = await tokenRes.json();

      // Fetch the SMS connection from the Management API
      const connectionsRes = await fetch(
        `https://${AUTH0_DOMAIN}/api/v2/connections?strategy=sms`,
        {
          headers: { Authorization: 'Bearer ' + token },
        },
      );

      expect(connectionsRes.ok).toBe(true);
      const connections = await connectionsRes.json();

      expect(connections.length).toBeGreaterThan(0);

      const smsConnection = connections.find((c) => c.strategy === 'sms');
      expect(smsConnection).toBeDefined();
      expect(smsConnection.name).toBe('sms');
    },
    15000,
  );
});

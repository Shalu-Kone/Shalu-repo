
const env = process.env.ENV || 'dev';

const configs = {
  dev: {
    domain: process.env.DEV_AUTH0_DOMAIN,
    clientId: process.env.DEV_AUTH0_CLIENT_ID,
    clientSecret: process.env.DEV_AUTH0_CLIENT_SECRET,
    connectionId: process.env.DEV_CONNECTION_ID
  },
  sit: {
    domain: process.env.SIT_AUTH0_DOMAIN,
    clientId: process.env.SIT_AUTH0_CLIENT_ID,
    clientSecret: process.env.SIT_AUTH0_CLIENT_SECRET,
    connectionId: process.env.SIT_CONNECTION_ID
  },
  prod: {
    domain: process.env.PROD_AUTH0_DOMAIN,
    clientId: process.env.PROD_AUTH0_CLIENT_ID,
    clientSecret: process.env.PROD_AUTH0_CLIENT_SECRET,
    connectionId: process.env.PROD_CONNECTION_ID
  }
};

const selected = configs[env];
if (!selected) {
  throw new Error(`Unsupported ENV "${env}". Expected one of: ${Object.keys(configs).join(", ")}`);
}

module.exports = selected;

// Define base configuration
const baseConfig = {
  AUTH_CLIENT_ID: "785152h8gp3l66m43abhh66vs3",
  AUTH_COGNITO_DOMAIN: "https://eu-west-2ehh7h32th.auth.eu-west-2.amazoncognito.com",
  AUTH_USER_POOL_ID: "eu-west-2_eHh7H32th",
  AUTH_PRICING_URL: "https://vestapropertychecker.com/pricing",
};

// Create dynamic configuration that uses Chrome APIs
export const AUTH_CONFIG = {
  ...baseConfig,
  get REDIRECT_URI() {
    return chrome.runtime.getURL("login-success.html");
  },
  get LOGOUT_URI() {
    return chrome.runtime.getURL("logout-success.html");
  },
};

/**
 * Environment Configuration
 *
 * This file centralizes all environment-specific configuration in one place.
 * It combines authentication settings and API endpoints based on the current environment.
 */

// Auth configuration per environment
const authConfigs = {
  development: {
    AUTH_CLIENT_ID: "785152h8gp3l66m43abhh66vs3",
    AUTH_COGNITO_DOMAIN: "https://eu-west-2ehh7h32th.auth.eu-west-2.amazoncognito.com",
    AUTH_USER_POOL_ID: "eu-west-2_eHh7H32th",
    AUTH_PRICING_URL: "https://vestapropertychecker.com/pricing",
  },
  production: {
    AUTH_CLIENT_ID: "5n2gk5qj1cclclfj4pl1v4f4qt", // Production Cognito Client ID
    AUTH_COGNITO_DOMAIN: "https://vesta-property-checker-prod.auth.eu-west-2.amazoncognito.com",
    AUTH_USER_POOL_ID: "eu-west-2_JnzrCsnYE", // Production Cognito User Pool ID
    AUTH_PRICING_URL: "https://vestapropertychecker.com/pricing",
  },
};

// Dynamic properties (same for all environments)
const dynamicProps = {
  get REDIRECT_URI() {
    return chrome.runtime.getURL("login-success.html");
  },
  get LOGOUT_URI() {
    return chrome.runtime.getURL("logout-success.html");
  },
};

// Get current environment from NODE_ENV
const environment = process.env.NODE_ENV || "production";
console.log(`[environmentConfig] Running in ${environment} environment`);

// Combined auth config with dynamic properties
const authConfig = {
  ...authConfigs[environment as keyof typeof authConfigs],
  ...dynamicProps,
};

// API config from .env variables (changes per environment through .env files)
const apiConfig = {
  MEASUREMENT_ID: process.env.MEASUREMENT_ID,
  API_SECRET: process.env.API_SECRET,
  GA_ENDPOINT: process.env.GA_ENDPOINT,
  VESTA_PROPERTY_DATA_ENDPOINT: process.env.VESTA_PROPERTY_DATA_ENDPOINT,
  VESTA_USER_ENDPOINT: process.env.VESTA_USER_ENDPOINT,
  USE_PREMIUM_DATA_MOCK_ON_FRONTEND: process.env.USE_PREMIUM_DATA_MOCK_ON_FRONTEND === "true",
};

// Export the combined configuration
export const ENV_CONFIG = {
  ...authConfig,
  ...apiConfig,
};

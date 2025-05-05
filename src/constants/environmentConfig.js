const authConfigs = {
  development: {
    AUTH_CLIENT_ID: "785152h8gp3l66m43abhh66vs3",
    AUTH_COGNITO_DOMAIN: "https://eu-west-2ehh7h32th.auth.eu-west-2.amazoncognito.com",
    AUTH_USER_POOL_ID: "eu-west-2_eHh7H32th",
    AUTH_PRICING_URL: "https://vestapropertychecker.com/pricing",
    // Add the specific Cognito host permission URLs needed by manifest.json
    COGNITO_IDP_HOST_PERMISSION:
      "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_eHh7H32th/*",
    COGNITO_AUTH_DOMAIN_HOST_PERMISSION:
      "https://eu-west-2ehh7h32th.auth.eu-west-2.amazoncognito.com/*",
  },
  production: {
    AUTH_CLIENT_ID: "5n2gk5qj1cclclfj4pl1v4f4qt", // Production Cognito Client ID
    AUTH_COGNITO_DOMAIN: "https://vesta-property-checker-prod.auth.eu-west-2.amazoncognito.com",
    AUTH_USER_POOL_ID: "eu-west-2_JnzrCsnYE", // Production Cognito User Pool ID
    AUTH_PRICING_URL: "https://vestapropertychecker.com/pricing",
    // Add the specific Cognito host permission URLs needed by manifest.json
    COGNITO_IDP_HOST_PERMISSION:
      "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_JnzrCsnYE/*",
    COGNITO_AUTH_DOMAIN_HOST_PERMISSION:
      "https://vesta-property-checker-prod.auth.eu-west-2.amazoncognito.com/*",
  },
};

const env = process.env.NODE_ENV || "development";

// Export the configuration for the current environment
// Use 'development' config if the specified NODE_ENV doesn't match 'production'
const environmentConfig = env === "production" ? authConfigs.production : authConfigs.development;

// Export the whole config object so Webpack can access both dev and prod settings
module.exports = { authConfigs, environmentConfig };

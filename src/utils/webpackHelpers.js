const transformManifestToUseHostPermissionsFromCurrentEnv = (
  content,
  authConfigs,
  env,
  packageJson
) => {
  const manifest = JSON.parse(content.toString());

  // --- Determine current and other configs internally ---
  const currentEnvKey = env === "production" ? "production" : "development";
  const otherEnvKey = env === "production" ? "development" : "production";
  const currentConfig = authConfigs[currentEnvKey];
  const otherConfig = authConfigs[otherEnvKey];

  // Check if configs exist to prevent errors
  if (!currentConfig || !otherConfig) {
    throw new Error(`Invalid environment configurations provided for env: ${env}`);
  }

  // --- Define URLs based on determined configs ---
  const currentCognitoHost = currentConfig.COGNITO_IDP_HOST_PERMISSION;
  const currentCognitoAuthDomain = currentConfig.COGNITO_AUTH_DOMAIN_HOST_PERMISSION;
  const otherCognitoHost = otherConfig.COGNITO_IDP_HOST_PERMISSION;
  const otherCognitoAuthDomain = otherConfig.COGNITO_AUTH_DOMAIN_HOST_PERMISSION;

  // --- Update host_permissions ---
  // Ensure host_permissions is an array before filtering
  manifest.host_permissions = Array.isArray(manifest.host_permissions)
    ? manifest.host_permissions
    : [];
  manifest.host_permissions = manifest.host_permissions.filter(
    (permission) => permission !== otherCognitoHost && permission !== otherCognitoAuthDomain
  );
  // Ensure current environment URLs are present (avoid duplicates)
  if (!manifest.host_permissions.includes(currentCognitoHost)) {
    manifest.host_permissions.push(currentCognitoHost);
  }
  if (!manifest.host_permissions.includes(currentCognitoAuthDomain)) {
    manifest.host_permissions.push(currentCognitoAuthDomain);
  }

  // Update version from package.json
  manifest.version = packageJson.version;

  return JSON.stringify(manifest, null, 2);
};

module.exports = {
  transformManifestToUseHostPermissionsFromCurrentEnv,
};

const fs = require("node:fs");
const path = require("node:path");

function resolveCredentialPath(candidatePath) {
  if (!candidatePath?.trim()) {
    return null;
  }

  const resolvedPath = path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(process.cwd(), candidatePath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(
      `[Dialogflow] Service account file not found at "${resolvedPath}". ` +
        "Dialogflow requests will fail until the file is available.",
    );
    return null;
  }

  return resolvedPath;
}

function configureGoogleCloudCredentials() {
  const configuredPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.DF_SERVICE_ACCOUNT_PATH;

  const resolvedPath = resolveCredentialPath(configuredPath);

  if (resolvedPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
  }
}

module.exports = configureGoogleCloudCredentials;

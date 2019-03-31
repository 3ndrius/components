/**
 * Identifies environment variables that are known vendor credentials and finds their corresponding SDK configuration properties
 * If credentials are provided, env vars are skipped and NOT overriden
 * @param {Object} envVars - Shallow object representing environment variables
 */

const addEnvVarsToCredentials = (envVars, credentials = {}) => {

  for (const provider in providers) {
    const providerEnvVars = providers[provider]
    for (const providerEnvVar in providerEnvVars) {
      if (!envVars.hasOwnProperty(providerEnvVar)) continue
      if (!credentials[provider]) credentials[provider] = {}
      // Skip if credential already exists
      if (credentials[provider][providerEnvVars[providerEnvVar]]) { continue }
      // Otherwise add credential from ENV var
      credentials[provider][providerEnvVars[providerEnvVar]] = envVars[providerEnvVar]
    }
  }

  return credentials
}

module.exports = addEnvVarsToCredentials

// Known Provider Environment Variables and their SDK configuration properties
const providers = {}

// AWS
providers.aws = {}
providers.aws.AWS_ACCESS_KEY_ID = 'accessKeyId'
providers.aws.AWS_SECRET_ACCESS_KEY = 'secretAccessKey'
providers.aws.AWS_SESSION_TOKEN = 'sessionToken'

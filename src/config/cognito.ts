/**
 * 🔐 AWS COGNITO CONFIGURATION
 * Configuration centralisée pour Amazon Cognito
 * Les valeurs sont injectées via les secrets Lovable (env vars)
 */

export const cognitoConfig = {
  userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_AWS_COGNITO_CLIENT_ID || '',
  region: import.meta.env.VITE_AWS_COGNITO_REGION || 'us-east-1',
};

/**
 * Vérifie si la configuration Cognito est disponible
 */
export const isCognitoConfigured = (): boolean => {
  return !!(cognitoConfig.userPoolId && cognitoConfig.clientId);
};

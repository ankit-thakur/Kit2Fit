export const config = {
  region: import.meta.env.VITE_AWS_REGION ?? 'us-east-1',
  userPoolId: import.meta.env.VITE_USER_POOL_ID ?? '',
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID ?? '',
  apiUrl: import.meta.env.VITE_API_URL ?? '',
};

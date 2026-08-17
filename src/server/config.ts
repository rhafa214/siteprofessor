export const ServerRuntimeConfig = {
  getGeminiApiKey: (): string | undefined => process.env.GEMINI_API_KEY,
  getAuthorizedUids: (): string | undefined => process.env.AUTHORIZED_FIREBASE_UIDS,
  getAllowedOrigins: (): string | undefined => process.env.ALLOWED_ORIGINS || process.env.VITE_ALLOWED_ORIGINS,
};

export function setServerRuntimeConfig(config: Partial<typeof ServerRuntimeConfig>) {
  Object.assign(ServerRuntimeConfig, config);
}

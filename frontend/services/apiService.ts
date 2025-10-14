import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { getCachedTokens, primeTokenCache } from '@/lib/token-cache';

function resolveBaseUrl(): string {
  const candidate = process.env.EXPO_PUBLIC_API_URL ?? 'https://localhost:2699';

  try {
    const parsed = new URL(candidate);
    const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocalhost) {
      throw new Error('Insecure API URL. HTTPS is required.');
    }
    return candidate;
  } catch (error) {
    throw new Error(
      `Invalid EXPO_PUBLIC_API_URL provided: ${candidate}. ${(error as Error).message}`,
    );
  }
}

/**
 * Shared Axios instance configured with Guardian defaults including base URL and token interceptors.
 */
export const apiService = axios.create({
  baseURL: resolveBaseUrl(),
});

apiService.interceptors.request.use(
  async (config) => {
    const [accessToken, refreshToken] = await getCachedTokens();

    config.headers = config.headers ?? {};

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (refreshToken && !config.headers['refresh-token']) {
      config.headers['refresh-token'] = refreshToken;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiService.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        try {
          const refreshResponse = await axios.post(
            `${apiService.defaults.baseURL}/api/v1/auth/refresh`,
            {},
            {
              headers: {
                'refresh-token': refreshToken,
              },
            },
          );
          const { accessToken, refreshToken: newRefresh } = refreshResponse.data.data;
          await SecureStore.setItemAsync('accessToken', accessToken);
          await SecureStore.setItemAsync('refreshToken', newRefresh);
          primeTokenCache('accessToken', accessToken);
          primeTokenCache('refreshToken', newRefresh);
          error.config.headers = error.config.headers ?? {};
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          error.config.headers['refresh-token'] = newRefresh;
          return apiService.request(error.config);
        } catch (refreshError) {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          primeTokenCache('accessToken', null);
          primeTokenCache('refreshToken', null);
        }
      }
    }
    return Promise.reject(error);
  },
);

export default apiService;

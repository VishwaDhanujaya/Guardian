import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { getCachedTokens, primeTokenCache } from '@/lib/token-cache';

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (loopbackHosts.has(normalized)) {
    return true;
  }

  const ipv4Match = normalized.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const [a, b] = octets;
    if (a === 10) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
  }

  // Covers IPv6 Unique Local Addresses (fc00::/7) and Link-Local (fe80::/10)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  return false;
}

function resolveBaseUrl(): string {
  const candidate = process.env.EXPO_PUBLIC_API_URL;

  if (!candidate) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not configured. Start the project with `npm run dev` or set the variable manually.',
    );
  }

  try {
    const parsed = new URL(candidate);
    const { protocol, hostname } = parsed;

    if (protocol === 'https:' || (protocol === 'http:' && isPrivateHostname(hostname))) {
      return candidate;
    }

    throw new Error('Insecure API URL. HTTPS is required.');
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

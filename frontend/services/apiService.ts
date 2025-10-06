import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/**
 * Shared Axios instance configured with Guardian defaults including base URL and token interceptors.
 */
export const apiService = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:2699',
});

apiService.interceptors.request.use(
  async (config) => {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync('accessToken'),
      SecureStore.getItemAsync('refreshToken'),
    ]);

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
          error.config.headers = error.config.headers ?? {};
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          error.config.headers['refresh-token'] = newRefresh;
          return apiService.request(error.config);
        } catch (refreshError) {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      }
    }
    return Promise.reject(error);
  },
);

export default apiService;

import MapboxGL from '@rnmapbox/maps';

const rawToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const token = typeof rawToken === 'string' && rawToken !== 'undefined' ? rawToken : undefined;

if (token) {
  MapboxGL.setAccessToken(token);
} else if (__DEV__) {
  console.warn(
    'Mapbox access token is not configured. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map view.',
  );
}

try {
  MapboxGL.setTelemetryEnabled(false);
} catch (error) {
  if (__DEV__) {
    console.warn('Unable to configure Mapbox telemetry.', error);
  }
}

export const MAPBOX_ACCESS_TOKEN = token;
export const isMapboxConfigured = typeof token === 'string' && token.length > 0;

export default MapboxGL;

import { fetchMapboxToken } from "@/lib/api";

export type MapboxLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

const DEFAULT_LATITUDE = 7.8731; // Sri Lanka centroid latitude
const DEFAULT_LONGITUDE = 80.7718; // Sri Lanka centroid longitude

export const DEFAULT_MAPBOX_CENTER: MapboxLocation = {
  latitude: DEFAULT_LATITUDE,
  longitude: DEFAULT_LONGITUDE,
};

let cachedToken: string | null = null;
let pendingToken: Promise<string> | null = null;

export async function getMapboxAccessToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }
  if (pendingToken) {
    return pendingToken;
  }

  pendingToken = fetchMapboxToken()
    .then((token) => {
      cachedToken = token;
      return token;
    })
    .finally(() => {
      pendingToken = null;
    });

  return pendingToken;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = Number.isFinite(latitude) ? latitude.toFixed(4) : "0";
  const lon = Number.isFinite(longitude) ? longitude.toFixed(4) : "0";
  return `Lat ${lat}, Lon ${lon}`;
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
  providedToken?: string,
): Promise<string> {
  const token = providedToken ?? (await getMapboxAccessToken());
  const searchParams = new URLSearchParams({
    access_token: token,
    types: "poi,address,place,locality,neighborhood",
    limit: "1",
  });

  const requestUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${searchParams.toString()}`;

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    features?: Array<{ place_name?: string }>;
  };

  const placeName = data?.features?.[0]?.place_name;
  if (typeof placeName === "string" && placeName.trim().length > 0) {
    return placeName.trim();
  }

  return formatCoordinates(latitude, longitude);
}

function clampDimension(value: number, fallback: number): number {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return fallback;
  }
  return Math.max(64, Math.min(1280, rounded));
}

export function buildStaticMapPreviewUrl(
  latitude: number,
  longitude: number,
  token: string,
  options?: {
    width?: number;
    height?: number;
    zoom?: number;
    theme?: "light" | "dark";
  },
): string {
  const lat = Number.isFinite(latitude) ? latitude : DEFAULT_MAPBOX_CENTER.latitude;
  const lon = Number.isFinite(longitude) ? longitude : DEFAULT_MAPBOX_CENTER.longitude;
  const width = clampDimension(options?.width ?? 600, 600);
  const height = clampDimension(options?.height ?? 360, 360);
  const zoomValue = options?.zoom;
  const zoom = Number.isFinite(zoomValue)
    ? Math.max(3, Math.min(20, Number(zoomValue)))
    : 15;
  const styleId = options?.theme === "dark" ? "mapbox/dark-v11" : "mapbox/streets-v12";
  const formattedLat = lat.toFixed(6);
  const formattedLon = lon.toFixed(6);
  const center = `${formattedLon},${formattedLat},${zoom.toFixed(2)},0`;
  const pin = `pin-l+ef4444(${formattedLon},${formattedLat})`;

  const query = new URLSearchParams({
    access_token: token,
    attribution: "false",
    logo: "false",
  });

  return `https://api.mapbox.com/styles/v1/${styleId}/static/${pin}/${center}/${width}x${height}@2x?${query.toString()}`;
}

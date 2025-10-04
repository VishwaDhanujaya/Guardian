import { fetchMapboxToken } from "@/lib/api";

export type MapboxLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

const DEFAULT_LATITUDE = -1.2921;
const DEFAULT_LONGITUDE = 36.8219;

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

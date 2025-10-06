import { fetchMapboxToken } from "@/lib/api";

export type MapboxLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

const DEFAULT_LATITUDE = 6.9271; // Colombo, Sri Lanka latitude
const DEFAULT_LONGITUDE = 79.8612; // Colombo, Sri Lanka longitude

/**
 * Default map center used when no coordinates are available from the backend.
 */
export const DEFAULT_MAPBOX_CENTER: MapboxLocation = {
  latitude: DEFAULT_LATITUDE,
  longitude: DEFAULT_LONGITUDE,
};

let cachedToken: string | null = null;
let pendingToken: Promise<string> | null = null;

/**
 * Provides a cached Mapbox access token, avoiding duplicate network requests across screens.
 */
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

/**
 * Formats a latitude and longitude into a compact human-readable string.
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = Number.isFinite(latitude) ? latitude.toFixed(4) : "0";
  const lon = Number.isFinite(longitude) ? longitude.toFixed(4) : "0";
  return `Lat ${lat}, Lon ${lon}`;
}

/**
 * Reverse geocodes a coordinate to a friendly place label, optionally using a provided token.
 */
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

/**
 * Builds a static Mapbox image URL for previewing a location pin within forms.
 */
export function buildStaticMapPreviewUrl(
  latitude: number,
  longitude: number,
  token: string,
  options?: {
    width?: number;
    height?: number;
    zoom?: number;
    theme?: "light" | "dark" | "monochrome";
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
  const styleId =
    options?.theme === "dark"
      ? "mapbox/dark-v11"
      : options?.theme === "monochrome"
        ? "mapbox/light-v11"
        : "mapbox/streets-v12";
  const formattedLat = lat.toFixed(6);
  const formattedLon = lon.toFixed(6);
  const center = `${formattedLon},${formattedLat},${zoom.toFixed(2)},0`;
  const pin = `pin-l+ef4444(${formattedLon},${formattedLat})`;

  const query = new URLSearchParams({
    access_token: token,
    attribution: "false",
    logo: "false",
  });

  if (options?.theme === "monochrome") {
    query.set("opt", "monochrome");
  }

  return `https://api.mapbox.com/styles/v1/${styleId}/static/${pin}/${center}/${width}x${height}@2x?${query.toString()}`;
}

export type MapboxSearchResult = MapboxLocation & {
  id: string;
  description?: string;
};

/**
 * Queries the Mapbox geocoding API for suggested places, supporting proximity and country hints.
 */
export async function searchMapboxLocations(
  query: string,
  options?: {
    limit?: number;
    proximity?: MapboxLocation;
    token?: string;
    countries?: string;
  },
): Promise<MapboxSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const token = options?.token ?? (await getMapboxAccessToken());
  const searchParams = new URLSearchParams({
    access_token: token,
    limit: String(options?.limit ?? 5),
    language: "en",
  });

  if (options?.proximity) {
    searchParams.set(
      "proximity",
      `${options.proximity.longitude.toFixed(6)},${options.proximity.latitude.toFixed(6)}`,
    );
  }

  if (options?.countries) {
    searchParams.set("country", options.countries);
  }

  const requestUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?${searchParams.toString()}`;

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    features?: Array<{
      id?: string;
      place_name?: string;
      center?: [number, number];
      text?: string;
      context?: Array<{ text?: string }>;
    }>;
  };

  const results: MapboxSearchResult[] = [];

  data.features?.forEach((feature) => {
    if (!feature) {
      return;
    }

    const center = Array.isArray(feature.center) ? feature.center : [];
    const longitude = Number(center[0]);
    const latitude = Number(center[1]);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    let description = feature.place_name ?? feature.text ?? "";
    if (!description && Array.isArray(feature.context)) {
      description = feature.context.map((ctx) => ctx.text).filter(Boolean).join(", ");
    }
    const trimmedDescription = description?.trim();

    results.push({
      id: feature.id ?? `${longitude},${latitude}`,
      latitude,
      longitude,
      label:
        trimmedDescription && trimmedDescription.length > 0
          ? trimmedDescription
          : formatCoordinates(latitude, longitude),
      description:
        trimmedDescription && trimmedDescription.length > 0 ? trimmedDescription : undefined,
    });
  });

  return results;
}

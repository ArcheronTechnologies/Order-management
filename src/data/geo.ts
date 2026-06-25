/**
 * Approximate coordinates of the clubs' home cities, for travel-distance costs —
 * a real burden for amateur Swedish clubs (Umeå in the far north to Trelleborg/
 * Malmö in the deep south is the better part of a day on the road).
 */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Stockholm: { lat: 59.33, lng: 18.07 },
  Uppsala: { lat: 59.86, lng: 17.64 },
  Enköping: { lat: 59.64, lng: 17.08 },
  Täby: { lat: 59.44, lng: 18.07 },
  Umeå: { lat: 63.83, lng: 20.26 },
  Norrköping: { lat: 58.59, lng: 16.18 },
  Örebro: { lat: 59.27, lng: 15.21 },
  Västerås: { lat: 59.61, lng: 16.55 },
  Linköping: { lat: 58.41, lng: 15.62 },
  Gävle: { lat: 60.67, lng: 17.14 },
  Södertälje: { lat: 59.2, lng: 17.63 },
  Göteborg: { lat: 57.71, lng: 11.97 },
  Lund: { lat: 55.7, lng: 13.19 },
  Malmö: { lat: 55.6, lng: 13.0 },
  Trelleborg: { lat: 55.38, lng: 13.16 },
  Vänersborg: { lat: 58.38, lng: 12.32 },
  Partille: { lat: 57.74, lng: 12.11 },
  Kungsbacka: { lat: 57.49, lng: 12.08 },
  Halmstad: { lat: 56.67, lng: 12.86 },
  Jönköping: { lat: 57.78, lng: 14.16 },
  Helsingborg: { lat: 56.05, lng: 12.69 },
  Kalmar: { lat: 56.66, lng: 16.36 },
  Borås: { lat: 57.72, lng: 12.94 },
};

/** Great-circle distance in km between two cities (0 if either is unknown). */
export function distanceKm(cityA: string, cityB: string): number {
  const a = CITY_COORDS[cityA];
  const b = CITY_COORDS[cityB];
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

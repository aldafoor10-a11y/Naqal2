/**
 * Free location search via OpenStreetMap Nominatim.
 * No API key required. Biased toward Iraq with Arabic locale.
 */

export type GeoResult = {
  place_id: number | string;
  display_name: string;
  short_name: string;
  latitude: number;
  longitude: number;
  type?: string;
};

const NOMINATIM = 'https://nominatim.openstreetmap.org';

let lastReqAt = 0;

async function throttle() {
  // Nominatim asks for max 1 req/sec.
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastReqAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReqAt = Date.now();
}

export async function searchLocation(query: string, limit = 6): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await throttle();
  const url =
    `${NOMINATIM}/search?format=json&addressdetails=1&limit=${limit}` +
    `&countrycodes=iq&accept-language=ar,en&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, {
      headers: { 'Accept-Language': 'ar,en', 'User-Agent': 'NaqalGo/1.0' },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data || []).map((d: any) => {
      const parts = (d.display_name || '').split(',').map((s: string) => s.trim());
      return {
        place_id: d.place_id,
        display_name: d.display_name,
        short_name: parts.slice(0, 2).join('، ') || d.display_name,
        latitude: parseFloat(d.lat),
        longitude: parseFloat(d.lon),
        type: d.type,
      } as GeoResult;
    });
  } catch (e) {
    console.warn('[geosearch]', e);
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  await throttle();
  try {
    const r = await fetch(
      `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar,en&zoom=16`,
      { headers: { 'User-Agent': 'NaqalGo/1.0' } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.display_name) return null;
    const parts = data.display_name.split(',').map((s: string) => s.trim());
    return parts.slice(0, 3).join('، ');
  } catch {
    return null;
  }
}

/**
 * HomeSphere - Geocoding & Reverse Geocoding Service
 * Powered by OpenStreetMap Nominatim Live API with robust timeouts, headers, and regional fallback
 */

const KNOWN_COORDINATES_MAP = {
  'peelamedu': { lat: 11.026700, lng: 77.002800, display_name: 'Peelamedu, Coimbatore, Tamil Nadu' },
  'rs puram': { lat: 11.009800, lng: 76.949200, display_name: 'RS Puram, Coimbatore, Tamil Nadu' },
  'r.s. puram': { lat: 11.009800, lng: 76.949200, display_name: 'RS Puram, Coimbatore, Tamil Nadu' },
  'r.s.puram': { lat: 11.009800, lng: 76.949200, display_name: 'RS Puram, Coimbatore, Tamil Nadu' },
  'gandhipuram': { lat: 11.018500, lng: 76.967800, display_name: 'Gandhipuram, Coimbatore, Tamil Nadu' },
  'saravanampatti': { lat: 11.082500, lng: 76.996100, display_name: 'Saravanampatti, Coimbatore, Tamil Nadu' },
  'saravanampatty': { lat: 11.082500, lng: 76.996100, display_name: 'Saravanampatti, Coimbatore, Tamil Nadu' },
  'race course': { lat: 11.001600, lng: 76.974000, display_name: 'Race Course, Coimbatore, Tamil Nadu' },
  'racecourse': { lat: 11.001600, lng: 76.974000, display_name: 'Race Course, Coimbatore, Tamil Nadu' },
  'singanallur': { lat: 11.002400, lng: 77.019500, display_name: 'Singanallur, Coimbatore, Tamil Nadu' },
  'vadavalli': { lat: 11.012500, lng: 76.892000, display_name: 'Vadavalli, Coimbatore, Tamil Nadu' },
  'avinashi road': { lat: 11.038000, lng: 77.039000, display_name: 'Avinashi Road, Coimbatore, Tamil Nadu' },
  'tidel park': { lat: 11.031000, lng: 77.032000, display_name: 'TIDEL Park, Coimbatore, Tamil Nadu' },
  'hope college': { lat: 11.033000, lng: 77.012000, display_name: 'Hope College, Peelamedu, Coimbatore' },
  'saibaba colony': { lat: 11.033000, lng: 76.946000, display_name: 'Saibaba Colony, Coimbatore, Tamil Nadu' },
  'ramanathapuram': { lat: 10.995000, lng: 76.985000, display_name: 'Ramanathapuram, Coimbatore, Tamil Nadu' },
  'thudiyalur': { lat: 11.080000, lng: 76.938000, display_name: 'Thudiyalur, Coimbatore, Tamil Nadu' },
  'koundampalayam': { lat: 11.045000, lng: 76.935000, display_name: 'Koundampalayam, Coimbatore, Tamil Nadu' },
  'ganapathy': { lat: 11.039000, lng: 76.978000, display_name: 'Ganapathy, Coimbatore, Tamil Nadu' },
  'kalapatti': { lat: 11.072000, lng: 77.036000, display_name: 'Kalapatti, Coimbatore, Tamil Nadu' },
  'sundarapuram': { lat: 10.948000, lng: 76.978000, display_name: 'Sundarapuram, Coimbatore, Tamil Nadu' },
  'kuniyamuthur': { lat: 10.957000, lng: 76.962000, display_name: 'Kuniyamuthur, Coimbatore, Tamil Nadu' },
  'ondipudur': { lat: 11.004000, lng: 77.042000, display_name: 'Ondipudur, Coimbatore, Tamil Nadu' },
  'perur': { lat: 10.972000, lng: 76.918000, display_name: 'Perur, Coimbatore, Tamil Nadu' },
  'coimbatore': { lat: 11.016800, lng: 76.955800, display_name: 'Coimbatore, Tamil Nadu' },
  'chennai': { lat: 13.082700, lng: 80.270700, display_name: 'Chennai, Tamil Nadu' },
  'bangalore': { lat: 12.971600, lng: 77.594600, display_name: 'Bengaluru, Karnataka' },
  'bengaluru': { lat: 12.971600, lng: 77.594600, display_name: 'Bengaluru, Karnataka' },
  'austin': { lat: 30.267153, lng: -97.743061, display_name: 'Austin, Texas, United States' },
  'seattle': { lat: 47.606210, lng: -122.332071, display_name: 'Seattle, Washington, United States' },
  'chicago': { lat: 41.878114, lng: -87.629798, display_name: 'Chicago, Illinois, United States' },
  'miami': { lat: 25.761680, lng: -80.191790, display_name: 'Miami, Florida, United States' }
};

/**
 * Forward Geocoding: Text Query -> { lat, lng, display_name, locality, city, state }
 * Attempts OpenStreetMap Nominatim Live Search first; falls back gracefully if offline/unmatched.
 */
async function geocodeAddress(queryText) {
  if (!queryText || typeof queryText !== 'string') {
    return {
      success: false,
      message: 'Query text is required for geocoding.'
    };
  }

  const cleanQuery = queryText.trim();
  if (cleanQuery.length < 2) {
    return {
      success: false,
      message: 'Query text is too short.'
    };
  }

  // 1. Try OpenStreetMap Nominatim Live Geocoding API (with 3.5s timeout)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&limit=1&addressdetails=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HomeSphere-RealEstate-Platform/2.0 (contact@homesphere.ai)',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const item = data[0];
        const addr = item.address || {};
        const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.village || cleanQuery.split(',')[0].trim();
        const city = addr.city || addr.town || addr.municipality || addr.county || 'Coimbatore';
        const state = addr.state || 'Tamil Nadu';

        let cleanName = item.display_name;
        if (cleanName && cleanName.includes(',')) {
          cleanName = cleanName.split(',').slice(0, 3).map(s => s.trim()).join(', ');
        }

        return {
          success: true,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          display_name: cleanName || `${locality}, ${city}, ${state}`,
          locality: locality,
          city: city,
          state: state,
          source: 'nominatim_live'
        };
      }
    }
  } catch (err) {
    console.warn(`[Geocoder] Nominatim live search timed out or failed for "${cleanQuery}":`, err.message);
  }

  // 2. Micro-Market Fallback Lookup
  const qLower = cleanQuery.toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_COORDINATES_MAP)) {
    if (qLower.includes(key)) {
      return {
        success: true,
        lat: val.lat,
        lng: val.lng,
        display_name: val.display_name,
        locality: key.charAt(0).toUpperCase() + key.slice(1),
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        source: 'regional_index'
      };
    }
  }

  // 3. Default fallback if in Coimbatore region
  return {
    success: true,
    lat: 11.016800,
    lng: 76.955800,
    display_name: `${cleanQuery}, Coimbatore, Tamil Nadu`,
    locality: cleanQuery.split(',')[0].trim(),
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    source: 'city_center_fallback'
  };
}

/**
 * Reverse Geocoding: (lat, lng) -> { display_name, locality, city, state }
 * Attempts OpenStreetMap Nominatim Live Reverse API; falls back gracefully.
 */
async function reverseGeocode(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    return {
      success: false,
      message: 'Valid latitude and longitude coordinates are required.'
    };
  }

  // 1. Try OpenStreetMap Nominatim Live Reverse API
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${numLat}&lon=${numLng}&format=json&addressdetails=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HomeSphere-RealEstate-Platform/2.0 (contact@homesphere.ai)',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timer);

    if (res.ok) {
      const item = await res.json();
      if (item && (item.display_name || item.address)) {
        const addr = item.address || {};
        const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.road || addr.village || addr.quarter || 'Coimbatore';
        const city = addr.city || addr.town || addr.municipality || addr.county || 'Coimbatore';
        const state = addr.state || 'Tamil Nadu';

        let cleanName = item.display_name;
        if (cleanName && cleanName.includes(',')) {
          cleanName = cleanName.split(',').slice(0, 3).map(s => s.trim()).join(', ');
        }

        return {
          success: true,
          lat: numLat,
          lng: numLng,
          display_name: cleanName || `${locality}, ${city}`,
          locality: locality,
          city: city,
          state: state,
          source: 'nominatim_reverse'
        };
      }
    }
  } catch (err) {
    console.warn(`[Geocoder] Nominatim reverse geocoding timed out or failed for (${numLat}, ${numLng}):`, err.message);
  }

  // 2. Micro-Market Proximity Match for Known Regions
  let closestDist = Infinity;
  let closestLoc = null;

  for (const [key, val] of Object.entries(KNOWN_COORDINATES_MAP)) {
    const dKm = 6371 * Math.acos(
      Math.min(1.0, Math.max(-1.0,
        Math.cos(numLat * Math.PI / 180) * Math.cos(val.lat * Math.PI / 180) * Math.cos((val.lng - numLng) * Math.PI / 180) +
        Math.sin(numLat * Math.PI / 180) * Math.sin(val.lat * Math.PI / 180)
      ))
    );
    if (dKm < closestDist) {
      closestDist = dKm;
      closestLoc = val;
    }
  }

  if (closestLoc && closestDist <= 3.5) {
    return {
      success: true,
      lat: numLat,
      lng: numLng,
      display_name: closestLoc.display_name,
      locality: closestLoc.display_name.split(',')[0].trim(),
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      source: 'proximity_matched'
    };
  }

  return {
    success: true,
    lat: numLat,
    lng: numLng,
    display_name: `Location at (${numLat.toFixed(4)}, ${numLng.toFixed(4)})`,
    locality: `${numLat.toFixed(3)}, ${numLng.toFixed(3)}`,
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    source: 'coordinate_label'
  };
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  KNOWN_COORDINATES_MAP
};

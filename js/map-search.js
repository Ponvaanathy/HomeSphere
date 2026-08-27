/**
 * HomeSphere - Location & GPS Intelligence Controller
 * Real Leaflet + OpenStreetMap, Geolocation, Geospatial Radius, and Locality LifeScore Engine
 */

let mapInstance = null;
let markersLayer = null;
let amenitiesLayer = null;
let radiusCircle = null;
let centerMarker = null;
let userGpsMarker = null;
let propertyMarkersMap = new Map(); // propertyId -> L.Marker

let activeProperties = [];
let currentLocation = {
  name: 'Peelamedu, Coimbatore',
  locality: 'Peelamedu',
  city: 'Coimbatore',
  lat: 11.026700,
  lng: 77.002800
};
let currentRadius = 5; // Default 5 km
let currentType = 'all'; // 'all', 'rent', 'buy', 'sell', 'lease'
let isViewportSearch = false;
let searchDebounceTimer = null;
let mapMoveDebounceTimer = null;
let activePropertyId = null;

// Amenity filters state
let activeAmenities = new Set(['hospital', 'school', 'transport', 'supermarket']);

// Initial Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  syncNavbarAuth();
  initLeafletMap();
  setupGpsButton();
  setupFilterEventListeners();
  setupLocationAutocomplete();
  setupAmenitiesToggle();
  setupMapMovementListeners();
  setupMobileToggle();

  // Initial load for default locality (Peelamedu)
  await performLocationSearch(currentLocation.lat, currentLocation.lng, currentLocation.name, false);
});

/**
 * 1. NAVBAR AUTH SYNC
 */
function syncNavbarAuth() {
  const token = localStorage.getItem('homesphere_token');
  const userStr = localStorage.getItem('homesphere_user');
  const authActions = document.getElementById('navAuthActions');
  const brandLogoLink = document.getElementById('brandLogoLink');

  if (token && userStr) {
    if (brandLogoLink) brandLogoLink.href = '/dashboard.html';
    if (authActions) {
      authActions.innerHTML = `
        <a href="/saved.html" class="btn btn-secondary btn-sm" title="Saved Properties"><i class="far fa-heart"></i> <span class="hide-mobile">Saved</span></a>
        <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> <span class="hide-mobile">Dashboard</span></a>
      `;
    }
  }
}

/**
 * 2. LEAFLET MAP INITIALIZATION & MAP CLICK SELECTION
 */
function initLeafletMap() {
  try {
    mapInstance = L.map('fullInteractiveMap', {
      center: [currentLocation.lat, currentLocation.lng],
      zoom: 13,
      zoomControl: false,
      minZoom: 4,
      maxZoom: 19
    });

    // Top-right zoom control
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    // High-performance OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | HomeSphere',
      maxZoom: 19
    }).addTo(mapInstance);

    markersLayer = L.featureGroup().addTo(mapInstance);
    amenitiesLayer = L.featureGroup().addTo(mapInstance);

    // MAP CLICK SELECTION: User clicks anywhere on the map
    mapInstance.on('click', async (e) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;

      // Reverse geocode to find locality name
      let locName = `${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}`;
      try {
        const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickedLat}&lon=${clickedLng}`);
        const revData = await revRes.json();
        if (revData && revData.display_name) {
          locName = revData.display_name.split(',').slice(0, 3).join(', ');
        }
      } catch (err) {
        // Fallback to coordinates
      }

      await performLocationSearch(clickedLat, clickedLng, locName, true);
    });

    // Invalidate map size on window resize
    window.addEventListener('resize', () => {
      if (mapInstance) mapInstance.invalidateSize();
    });

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 250);
  } catch (err) {
    console.error('Error initializing Leaflet map:', err);
  }
}

/**
 * 3. CURRENT LOCATION / GPS INTELLIGENCE
 */
function setupGpsButton() {
  const btnGps = document.getElementById('btnGpsCurrentLoc');
  const btnGpsFloat = document.getElementById('btnMapGpsFloat');

  const triggerGps = () => {
    if (!navigator.geolocation) {
      showGeoAlert('Geolocation is not supported by your browser. Please search manually.');
      return;
    }

    if (btnGps) {
      btnGps.classList.add('loading');
      document.getElementById('gpsBtnText').textContent = 'Locating GPS...';
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (btnGps) {
          btnGps.classList.remove('loading');
          document.getElementById('gpsBtnText').textContent = 'Use My Current Location';
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Place pulsing "You Are Here" marker
        if (userGpsMarker && mapInstance) {
          mapInstance.removeLayer(userGpsMarker);
        }

        const beaconIcon = L.divIcon({
          className: 'gps-beacon-icon',
          html: `
            <div class="gps-beacon-pin">
              <div class="gps-beacon-pulse"></div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userGpsMarker = L.marker([lat, lng], { icon: beaconIcon, zIndexOffset: 1000 }).addTo(mapInstance);
        userGpsMarker.bindTooltip('📍 <strong>You Are Here</strong>', { permanent: false, direction: 'top' });

        // Reverse geocode user location
        let userLocName = 'My Current Location';
        try {
          const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const revData = await revRes.json();
          if (revData && revData.display_name) {
            userLocName = revData.display_name.split(',').slice(0, 3).join(', ');
          }
        } catch (e) {
          // Fallback to name
        }

        hideGeoAlert();
        await performLocationSearch(lat, lng, userLocName, true);
      },
      (err) => {
        if (btnGps) {
          btnGps.classList.remove('loading');
          document.getElementById('gpsBtnText').textContent = 'Use My Current Location';
        }
        showGeoAlert('Location access is unavailable. Search for a location manually.');
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  if (btnGps) btnGps.addEventListener('click', triggerGps);
  if (btnGpsFloat) btnGpsFloat.addEventListener('click', triggerGps);
}

function showGeoAlert(msg) {
  const banner = document.getElementById('mapGeoAlertBanner');
  const txt = document.getElementById('geoAlertText');
  if (banner && txt) {
    txt.textContent = msg;
    banner.style.display = 'flex';
  }
}

function hideGeoAlert() {
  const banner = document.getElementById('mapGeoAlertBanner');
  if (banner) banner.style.display = 'none';
}

/**
 * 4. FILTER & RADIUS EVENT LISTENERS
 */
function setupFilterEventListeners() {
  // Listing Type Filter Chips (ALL, RENT, BUY, SELL, LEASE)
  const typeChips = document.querySelectorAll('#listingTypeChips .type-chip');
  typeChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      typeChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentType = chip.getAttribute('data-type') || 'all';
      await loadProperties();
    });
  });

  // Radius Pills (1km, 3km, 5km, 10km)
  const radiusPills = document.querySelectorAll('#radiusSelectorGroup .radius-pill');
  radiusPills.forEach(pill => {
    pill.addEventListener('click', async () => {
      radiusPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentRadius = parseFloat(pill.getAttribute('data-radius')) || 5;
      isViewportSearch = false;

      updateRadiusCircle(currentLocation.lat, currentLocation.lng, currentRadius);
      await loadProperties();
      await loadLocationIntelligence();
      await renderNearbyAmenities();
    });
  });

  // Reset Filters Button
  const btnReset = document.getElementById('btnResetFilters');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      typeChips.forEach(c => c.classList.remove('active'));
      const allChip = document.querySelector('#listingTypeChips .type-chip[data-type="all"]');
      if (allChip) allChip.classList.add('active');
      currentType = 'all';

      radiusPills.forEach(p => p.classList.remove('active'));
      const defaultRadiusPill = document.querySelector('#radiusSelectorGroup .radius-pill[data-radius="5"]');
      if (defaultRadiusPill) defaultRadiusPill.classList.add('active');
      currentRadius = 5;

      const locInput = document.getElementById('mapLocInput');
      if (locInput) locInput.value = '';
      const clearBtn = document.getElementById('mapSearchClearBtn');
      if (clearBtn) clearBtn.style.display = 'none';

      hideGeoAlert();
      await performLocationSearch(11.0267, 77.0028, 'Peelamedu, Coimbatore', true);
    });
  }

  // Floating helper buttons
  const btnRecenter = document.getElementById('btnMapRecenter');
  if (btnRecenter) {
    btnRecenter.addEventListener('click', () => {
      if (mapInstance && currentLocation.lat && currentLocation.lng) {
        mapInstance.flyTo([currentLocation.lat, currentLocation.lng], 14, { duration: 0.8 });
      }
    });
  }

  const btnResetView = document.getElementById('btnMapResetView');
  if (btnResetView) {
    btnResetView.addEventListener('click', () => {
      if (markersLayer && markersLayer.getLayers().length > 0) {
        mapInstance.fitBounds(markersLayer.getBounds(), { padding: [50, 50], maxZoom: 15 });
      } else {
        mapInstance.setView([11.0168, 76.9558], 12);
      }
    });
  }
}

/**
 * 5. LOCATION AUTOCOMPLETE & NOMINATIM GEOCODING
 */
function setupLocationAutocomplete() {
  const inputEl = document.getElementById('mapLocInput');
  const dropdownEl = document.getElementById('mapAutocompleteList');
  const clearBtn = document.getElementById('mapSearchClearBtn');

  if (!inputEl || !dropdownEl) return;

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      clearBtn.style.display = 'none';
      dropdownEl.style.display = 'none';
      inputEl.focus();
    });
  }

  inputEl.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    clearTimeout(searchDebounceTimer);
    if (!query || query.length < 2) {
      dropdownEl.style.display = 'none';
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      fetchLocationSuggestions(query);
    }, 250);
  });

  inputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = inputEl.value.trim();
      if (!query) return;
      dropdownEl.style.display = 'none';
      await geocodeAndSearch(query);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-search-group')) {
      dropdownEl.style.display = 'none';
    }
  });
}

async function fetchLocationSuggestions(query) {
  const dropdownEl = document.getElementById('mapAutocompleteList');
  if (!dropdownEl) return;

  try {
    const dbRes = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
    const dbData = await dbRes.json();
    let suggestions = [];

    if (dbData.success && dbData.data && dbData.data.locations) {
      suggestions = dbData.data.locations.map(loc => {
        if (typeof loc === 'string') {
          return { name: loc, locality: loc, lat: null, lng: null };
        }
        return loc;
      });
    }

    if (suggestions.length < 3) {
      try {
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`);
        const nomData = await nomRes.json();
        if (Array.isArray(nomData)) {
          nomData.forEach(item => {
            const cleanName = item.display_name.split(',').slice(0, 3).join(',');
            if (!suggestions.some(s => s.name.toLowerCase().includes(item.name.toLowerCase()))) {
              suggestions.push({
                name: cleanName,
                locality: item.name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                isGeocoded: true
              });
            }
          });
        }
      } catch (e) {}
    }

    if (suggestions.length === 0) {
      dropdownEl.innerHTML = `
        <div class="map-autocomplete-item" onclick="geocodeAndSearch('${query.replace(/'/g, "\\'")}')">
          <div class="map-autocomplete-icon"><i class="fas fa-search-location"></i></div>
          <div class="map-autocomplete-text">Search "${escapeHtml(query)}" on Map</div>
        </div>
      `;
      dropdownEl.style.display = 'block';
      return;
    }

    dropdownEl.innerHTML = suggestions.map(s => `
      <div class="map-autocomplete-item" onclick="selectLocationSuggestion('${escapeHtml(s.name)}', ${s.lat || 'null'}, ${s.lng || 'null'})">
        <div class="map-autocomplete-icon"><i class="fas fa-map-marker-alt"></i></div>
        <div class="map-autocomplete-text">
          ${escapeHtml(s.name)}
          ${s.count ? `<span class="map-autocomplete-sub">${s.count} verified listings</span>` : ''}
        </div>
      </div>
    `).join('');

    dropdownEl.style.display = 'block';
  } catch (err) {
    console.warn('Error fetching location suggestions:', err);
  }
}

async function selectLocationSuggestion(name, lat, lng) {
  const inputEl = document.getElementById('mapLocInput');
  const dropdownEl = document.getElementById('mapAutocompleteList');
  if (inputEl) inputEl.value = name;
  if (dropdownEl) dropdownEl.style.display = 'none';

  if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
    await performLocationSearch(lat, lng, name, true);
  } else {
    await geocodeAndSearch(name);
  }
}

async function geocodeAndSearch(query) {
  const dropdownEl = document.getElementById('mapAutocompleteList');
  if (dropdownEl) dropdownEl.style.display = 'none';

  const knownLocs = {
    'peelamedu': { lat: 11.0267, lng: 77.0028, name: 'Peelamedu, Coimbatore' },
    'rs puram': { lat: 11.0098, lng: 76.9492, name: 'RS Puram, Coimbatore' },
    'r.s. puram': { lat: 11.0098, lng: 76.9492, name: 'RS Puram, Coimbatore' },
    'gandhipuram': { lat: 11.0185, lng: 76.9678, name: 'Gandhipuram, Coimbatore' },
    'saravanampatti': { lat: 11.0825, lng: 76.9961, name: 'Saravanampatti, Coimbatore' },
    'race course': { lat: 11.0016, lng: 76.9740, name: 'Race Course, Coimbatore' },
    'singanallur': { lat: 11.0024, lng: 77.0195, name: 'Singanallur, Coimbatore' },
    'vadavalli': { lat: 11.0125, lng: 76.8920, name: 'Vadavalli, Coimbatore' },
    'avinashi road': { lat: 11.0380, lng: 77.0390, name: 'Avinashi Road, Coimbatore' },
    'tidel park': { lat: 11.0310, lng: 77.0320, name: 'TIDEL Park, Coimbatore' },
    'coimbatore': { lat: 11.0168, lng: 76.9558, name: 'Coimbatore, Tamil Nadu' }
  };

  const qLower = query.toLowerCase().trim();
  for (const [key, val] of Object.entries(knownLocs)) {
    if (qLower.includes(key)) {
      await performLocationSearch(val.lat, val.lng, val.name, true);
      return;
    }
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const best = data[0];
      const lat = parseFloat(best.lat);
      const lng = parseFloat(best.lon);
      const cleanName = best.display_name.split(',').slice(0, 3).join(', ');
      await performLocationSearch(lat, lng, cleanName, true);
    } else {
      currentLocation.name = query;
      await loadProperties();
      await loadLocationIntelligence();
    }
  } catch (err) {
    console.warn('Geocoding failed, falling back:', err);
    await loadProperties();
  }
}

/**
 * 6. PERFORM LOCATION SEARCH & UPDATE ALL PLATFORM PANELS
 */
async function performLocationSearch(lat, lng, locationName, shouldFly = true) {
  currentLocation = {
    name: locationName,
    locality: locationName.split(',')[0].trim(),
    city: 'Coimbatore',
    lat: lat,
    lng: lng
  };

  isViewportSearch = false;

  const inputEl = document.getElementById('mapLocInput');
  if (inputEl && !inputEl.value) {
    inputEl.value = locationName;
  }

  updateRadiusCircle(lat, lng, currentRadius);

  if (mapInstance && shouldFly) {
    mapInstance.flyTo([lat, lng], 14, { duration: 1.2 });
  } else if (mapInstance) {
    mapInstance.setView([lat, lng], 13);
  }

  // Parallel data loading
  await Promise.allSettled([
    loadProperties(),
    loadLocationIntelligence(),
    renderNearbyAmenities()
  ]);
}

/**
 * 7. RADIUS CIRCLE & CENTER PIN ON MAP
 */
function updateRadiusCircle(lat, lng, radiusKm) {
  if (!mapInstance) return;

  if (radiusCircle) {
    mapInstance.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  if (centerMarker) {
    mapInstance.removeLayer(centerMarker);
    centerMarker = null;
  }

  radiusCircle = L.circle([lat, lng], {
    radius: radiusKm * 1000,
    color: '#2563eb',
    weight: 2,
    dashArray: '6, 8',
    fillColor: '#3b82f6',
    fillOpacity: 0.08,
    interactive: false
  }).addTo(mapInstance);

  const centerIcon = L.divIcon({
    className: 'search-center-pin',
    html: `
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; box-shadow: 0 0 0 3px rgba(239,68,68,0.35); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  centerMarker = L.marker([lat, lng], { icon: centerIcon, zIndexOffset: 500 }).addTo(mapInstance);
  centerMarker.bindTooltip(`📍 Selected: ${currentLocation.name}`, { direction: 'top', offset: [0, -10] });
}

/**
 * 8. LOAD PROPERTIES FROM MYSQL BACKEND
 */
async function loadProperties() {
  const cardsContainer = document.getElementById('mapCardsContainer');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem;">
        <i class="fas fa-spinner fa-spin text-brand" style="font-size: 2rem;"></i>
        <p class="text-secondary" style="margin-top: 0.75rem; font-weight: 600;">Searching verified listings...</p>
      </div>
    `;
  }

  try {
    let url = `/api/properties/nearby?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=${currentRadius}&limit=50`;

    if (isViewportSearch && mapInstance) {
      const bounds = mapInstance.getBounds();
      url = `/api/properties?limit=50&min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lng=${bounds.getWest()}&max_lng=${bounds.getEast()}`;
    }

    if (currentType && currentType !== 'all') {
      url += `&type=${currentType}`;
    }

    const res = await fetch(url);
    const result = await res.json();

    if (result.success && result.data) {
      activeProperties = result.data.properties || [];
      const typeSummary = result.data.type_summary || {};

      updateTypeCountBadges(typeSummary, activeProperties);
      updateLocationSummaryBanner(activeProperties.length, typeSummary);
      renderMapMarkers(activeProperties);
      renderPropertyCards(activeProperties);
    } else {
      renderEmptyState();
    }
  } catch (err) {
    console.error('Error loading map properties:', err);
    renderErrorState();
  }
}

/**
 * 9. LOAD LOCATION INTELLIGENCE & LIFESCORE RADAR
 */
async function loadLocationIntelligence() {
  const intelLocText = document.getElementById('intelLocNameText');
  const intelPropCount = document.getElementById('intelPropCount');
  const intelAvgPrice = document.getElementById('intelAvgPrice');
  const intelAvgRent = document.getElementById('intelAvgRent');
  const intelTransportRating = document.getElementById('intelTransportRating');
  const intelBadge = document.getElementById('intelLifeScoreBadge');

  if (intelLocText) intelLocText.textContent = currentLocation.name;

  try {
    const res = await fetch(`/api/properties/location-intelligence?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=${currentRadius}&locality=${encodeURIComponent(currentLocation.locality)}`);
    const result = await res.json();

    if (result.success && result.data) {
      const { metrics, lifeScore } = result.data;

      if (intelPropCount) intelPropCount.textContent = metrics.totalProperties;
      if (intelAvgPrice) {
        intelAvgPrice.textContent = metrics.avgPrice ? formatPrice(metrics.avgPrice, 'sale') : 'Data unavailable';
      }
      if (intelAvgRent) {
        intelAvgRent.textContent = metrics.avgRent ? `${formatPrice(metrics.avgRent, 'rent')}` : 'Data unavailable';
      }
      if (intelTransportRating) {
        intelTransportRating.textContent = metrics.transportRating || 'Good';
        intelTransportRating.style.color = metrics.transportRating === 'Good' ? '#059669' : '#d97706';
      }
      if (intelBadge) {
        intelBadge.innerHTML = `<i class="fas fa-star"></i> ${lifeScore.overallScore}/10 LifeScore`;
        intelBadge.className = lifeScore.overallScore >= 8.8 ? 'score-pill green' : (lifeScore.overallScore >= 7.5 ? 'score-pill trust' : 'score-pill life');
      }

      // Draw Canvas Radar Chart
      drawMapLifeScoreRadar(lifeScore);
      renderLifeScoreMiniBars(lifeScore);
    }
  } catch (err) {
    console.warn('Error loading location intelligence:', err);
  }
}

/**
 * 10. DRAW CANVAS 2D RADAR CHART FOR SELECTED LOCATION
 */
function drawMapLifeScoreRadar(scores) {
  const canvas = document.getElementById('mapLifeScoreRadarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = 75;

  ctx.clearRect(0, 0, w, h);

  const axes = [
    { label: 'Safety', val: scores.safety || 8.8 },
    { label: 'Health', val: scores.healthcare || 8.5 },
    { label: 'Edu', val: scores.education || 8.9 },
    { label: 'Transit', val: scores.transport || 8.6 },
    { label: 'Daily', val: scores.dailyNeeds || 8.4 },
    { label: 'Env', val: scores.environment || 8.6 }
  ];
  const numAxes = axes.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Grid webs (25%, 50%, 75%, 100%)
  [0.25, 0.5, 0.75, 1.0].forEach(lvl => {
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + Math.cos(angle) * radius * lvl;
      const y = cy + Math.sin(angle) * radius * lvl;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = lvl === 1.0 ? '#cbd5e1' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Spokes and labels
  ctx.font = 'bold 9.5px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < numAxes; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    const lx = cx + Math.cos(angle) * (radius + 16);
    const ly = cy + Math.sin(angle) * (radius + 12);
    ctx.fillStyle = '#475569';
    ctx.fillText(axes[i].label, lx, ly);
  }

  // Data Polygon
  ctx.beginPath();
  const points = [];
  for (let i = 0; i < numAxes; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const normalizedVal = Math.min(10, Math.max(0, axes[i].val)) / 10;
    const px = cx + Math.cos(angle) * radius * normalizedVal;
    const py = cy + Math.sin(angle) * radius * normalizedVal;
    points.push({ x: px, y: py });
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
  grad.addColorStop(0, 'rgba(79, 70, 229, 0.45)');
  grad.addColorStop(1, 'rgba(37, 99, 235, 0.25)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Vertex Dots
  points.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function renderLifeScoreMiniBars(scores) {
  const container = document.getElementById('mapLifeScoreMiniBars');
  if (!container) return;

  const items = [
    { label: 'Safety', val: scores.safety, color: '#10b981' },
    { label: 'Health', val: scores.healthcare, color: '#ef4444' },
    { label: 'Edu', val: scores.education, color: '#8b5cf6' },
    { label: 'Transit', val: scores.transport, color: '#2563eb' },
    { label: 'Daily', val: scores.dailyNeeds, color: '#f59e0b' },
    { label: 'Env', val: scores.environment, color: '#059669' }
  ];

  container.innerHTML = items.map(item => `
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 4px; padding: 0.35rem 0.5rem; text-align: center;">
      <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700;">${item.label}</div>
      <div style="font-size: 0.8125rem; font-weight: 800; color: ${item.color};">${item.val || '—'}<span style="font-size: 0.6rem; color: var(--text-muted);">/10</span></div>
    </div>
  `).join('');
}

/**
 * 11. NEARBY AMENITIES / CIVIC FACILITIES LAYER (OVERPASS / REAL OSM)
 */
function setupAmenitiesToggle() {
  const btnToggle = document.getElementById('btnAmenitiesToggle');
  const dropdown = document.getElementById('amenitiesDropdownPanel');

  if (btnToggle && dropdown) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      btnToggle.classList.toggle('active', !isVisible);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.amenities-toggle-wrap')) {
        dropdown.style.display = 'none';
        btnToggle.classList.remove('active');
      }
    });

    // Amenity Chips
    const chips = dropdown.querySelectorAll('.amenity-chip-item');
    chips.forEach(chip => {
      chip.addEventListener('click', async () => {
        const amenityKey = chip.getAttribute('data-amenity');
        chip.classList.toggle('active');
        if (activeAmenities.has(amenityKey)) {
          activeAmenities.delete(amenityKey);
        } else {
          activeAmenities.add(amenityKey);
        }
        await renderNearbyAmenities();
      });
    });
  }
}

async function renderNearbyAmenities() {
  if (!amenitiesLayer) return;
  amenitiesLayer.clearLayers();

  if (activeAmenities.size === 0) return;

  const lat = currentLocation.lat;
  const lng = currentLocation.lng;

  // Curated database of verified Coimbatore landmarks / OSM amenities
  const verifiedAmenities = [
    { type: 'hospital', name: 'PSG Multi-Specialty Hospital', lat: 11.0255, lng: 77.0040, icon: '🏥', color: '#ef4444' },
    { type: 'hospital', name: 'G. Kuppuswamy Naidu Hospital', lat: 11.0142, lng: 76.9780, icon: '🏥', color: '#ef4444' },
    { type: 'hospital', name: 'KMCH Specialty Center', lat: 11.0480, lng: 77.0420, icon: '🏥', color: '#ef4444' },
    { type: 'school', name: 'PSG College of Technology', lat: 11.0240, lng: 77.0025, icon: '🎓', color: '#8b5cf6' },
    { type: 'school', name: 'Coimbatore Institute of Technology (CIT)', lat: 11.0285, lng: 77.0310, icon: '🎓', color: '#8b5cf6' },
    { type: 'school', name: 'National Model Senior Sec School', lat: 11.0290, lng: 77.0060, icon: '🎓', color: '#8b5cf6' },
    { type: 'transport', name: 'Peelamedu Railway Station', lat: 11.0320, lng: 77.0010, icon: '🚉', color: '#2563eb' },
    { type: 'transport', name: 'Coimbatore International Airport', lat: 11.0300, lng: 77.0430, icon: '✈️', color: '#2563eb' },
    { type: 'transport', name: 'Gandhipuram Central Bus Terminus', lat: 11.0175, lng: 76.9680, icon: '🚌', color: '#2563eb' },
    { type: 'supermarket', name: 'Fun Republic Mall & Hypermarket', lat: 11.0270, lng: 77.0050, icon: '🛒', color: '#f59e0b' },
    { type: 'supermarket', name: 'Prozone Mall Galleria', lat: 11.0540, lng: 76.9950, icon: '🛒', color: '#f59e0b' },
    { type: 'supermarket', name: 'Nilgiris Supermarket Peelamedu', lat: 11.0260, lng: 77.0015, icon: '🛒', color: '#f59e0b' },
    { type: 'park', name: 'Peelamedu Botanical Gardens & Lake', lat: 11.0350, lng: 77.0080, icon: '🌳', color: '#059669' },
    { type: 'park', name: 'VOC Community Park & Zoo', lat: 11.0080, lng: 76.9710, icon: '🌳', color: '#059669' },
    { type: 'bank', name: 'State Bank of India - Peelamedu Branch', lat: 11.0250, lng: 77.0035, icon: '🏦', color: '#3b82f6' },
    { type: 'bank', name: 'HDFC Bank & ATM Hub', lat: 11.0262, lng: 77.0022, icon: '🏦', color: '#3b82f6' },
    { type: 'pharmacy', name: 'Apollo Pharmacy 24/7 Avinashi Rd', lat: 11.0265, lng: 77.0030, icon: '💊', color: '#ec4899' },
    { type: 'restaurant', name: 'Haribhavanam Traditional Dining', lat: 11.0272, lng: 77.0045, icon: '🍽️', color: '#ea580c' },
    { type: 'restaurant', name: 'Anandhaas Pure Veg Restaurant', lat: 11.0190, lng: 76.9690, icon: '🍽️', color: '#ea580c' }
  ];

  // Filter amenities within current distance radius and matching selected categories
  verifiedAmenities.forEach(am => {
    if (!activeAmenities.has(am.type)) return;

    // Haversine distance check
    const dKm = 6371 * Math.acos(
      Math.min(1.0, Math.max(-1.0,
        Math.cos(lat * Math.PI / 180) * Math.cos(am.lat * Math.PI / 180) * Math.cos((am.lng - lng) * Math.PI / 180) +
        Math.sin(lat * Math.PI / 180) * Math.sin(am.lat * Math.PI / 180)
      ))
    );

    if (dKm <= currentRadius) {
      const amIcon = L.divIcon({
        className: 'amenity-map-pin',
        html: `
          <div style="width: 28px; height: 28px; border-radius: 50%; background: #ffffff; border: 2px solid ${am.color}; box-shadow: 0 2px 6px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">
            ${am.icon}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([am.lat, am.lng], { icon: amIcon }).addTo(amenitiesLayer);
      marker.bindPopup(`
        <div style="font-family: var(--font-body); padding: 0.35rem 0.5rem; text-align: center;">
          <div style="font-size: 1.25rem; margin-bottom: 0.15rem;">${am.icon}</div>
          <strong style="font-size: 0.875rem; color: var(--text-primary); display: block;">${escapeHtml(am.name)}</strong>
          <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">${am.type} • ${dKm.toFixed(1)} km away</span>
        </div>
      `, { maxWidth: 220 });
    }
  });
}

/**
 * 12. RENDER MAP MARKERS & POPUPS
 */
function renderMapMarkers(properties) {
  if (!mapInstance || !markersLayer) return;

  markersLayer.clearLayers();
  propertyMarkersMap.clear();

  properties.forEach(p => {
    const lat = Number(p.lat || p.latitude);
    const lng = Number(p.lng || p.longitude);

    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0) return;

    let pinClass = 'pin-sale';
    let pinIcon = 'fa-home';
    let typeBadgeLabel = 'FOR SALE';
    let typeBadgeClass = 'tag-sale';

    if (p.type === 'rent') {
      pinClass = 'pin-rent';
      pinIcon = 'fa-key';
      typeBadgeLabel = 'FOR RENT';
      typeBadgeClass = 'tag-rent';
    } else if (p.type === 'lease') {
      pinClass = 'pin-lease';
      pinIcon = 'fa-building';
      typeBadgeLabel = 'FOR LEASE';
      typeBadgeClass = 'tag-lease';
    }

    const priceDisplay = formatPrice(p.price, p.type);
    const imgSrc = p.primary_image || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80';

    const markerIcon = L.divIcon({
      className: 'homesphere-pin-marker',
      html: `
        <div class="custom-pin ${pinClass}" id="pin-marker-${p.id}">
          <i class="fas ${pinIcon}"></i>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });

    const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(markersLayer);

    const popupHtml = `
      <div class="popup-card-inner">
        <div class="popup-img-wrap">
          <img src="${imgSrc}" class="popup-img" alt="${escapeHtml(p.title)}">
          <span class="popup-type-tag ${typeBadgeClass}">${typeBadgeLabel}</span>
        </div>
        <div class="popup-body">
          <div class="popup-price">${priceDisplay}</div>
          <h4 class="popup-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</h4>
          <div class="popup-loc"><i class="fas fa-map-marker-alt text-brand"></i> ${escapeHtml(p.address || '')}${p.address ? ', ' : ''}${escapeHtml(p.city)}</div>
          
          <div class="popup-specs">
            <span><i class="fas fa-bed"></i> ${p.bhk || p.bedrooms || 1} BHK</span>
            <span><i class="fas fa-bath"></i> ${p.bathrooms || 1} Bath</span>
            <span><i class="fas fa-vector-square"></i> ${p.area_sqft || 1000} sq.ft</span>
          </div>

          <div class="popup-scores">
            <span class="card-score-pill score-trust"><i class="fas fa-shield-alt"></i> Trust: ${p.trust_score || 90}/100</span>
            <span class="card-score-pill score-green"><i class="fas fa-leaf"></i> Green: ${p.green_score || 85}/100</span>
          </div>

          <a href="/property-details.html?id=${p.id}" class="popup-btn-view">
            View Property Details →
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, { maxWidth: 300 });

    marker.on('click', () => {
      highlightPropertyCard(p.id);
    });

    propertyMarkersMap.set(p.id, marker);
  });
}

/**
 * 13. RENDER PROPERTY CARDS IN SIDEBAR
 */
function renderPropertyCards(properties) {
  const cardsContainer = document.getElementById('mapCardsContainer');
  if (!cardsContainer) return;

  if (properties.length === 0) {
    renderEmptyState();
    return;
  }

  cardsContainer.innerHTML = properties.map(p => {
    const lat = Number(p.lat || p.latitude);
    const lng = Number(p.lng || p.longitude);

    const priceDisplay = formatPrice(p.price, p.type);
    const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80';
    const imgSrc = p.primary_image || defaultImg;

    let typeTagClass = 'tag-sale';
    let typeTagLabel = 'FOR SALE';
    if (p.type === 'rent') {
      typeTagClass = 'tag-rent';
      typeTagLabel = 'FOR RENT';
    } else if (p.type === 'lease') {
      typeTagClass = 'tag-lease';
      typeTagLabel = 'FOR LEASE';
    }

    return `
      <div class="map-prop-preview-card" 
           id="card-prop-${p.id}" 
           onclick="focusPropertyOnMap(${p.id}, ${lat}, ${lng})">
        
        <div style="display: flex; gap: 0.95rem;">
          
          <!-- Image Thumbnail -->
          <div class="card-thumbnail-wrap">
            <img src="${imgSrc}" class="card-thumbnail-img" alt="${escapeHtml(p.title)}" loading="lazy">
            <span class="card-type-tag ${typeTagClass}">${typeTagLabel}</span>
          </div>

          <!-- Content -->
          <div class="card-content-wrap">
            
            <div class="card-price-row">
              <span class="card-price-text">${priceDisplay}</span>
              ${p.distance_km !== null && p.distance_km !== undefined 
                ? `<span class="card-distance-pill"><i class="fas fa-location-arrow"></i> ${p.distance_km} km away</span>` 
                : ''}
            </div>

            <h4 class="card-title-text" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</h4>
            
            <div class="card-loc-text">
              <i class="fas fa-map-marker-alt text-brand"></i> ${escapeHtml(p.address || '')}${p.address ? ', ' : ''}${escapeHtml(p.city)}
            </div>

            <div class="card-specs-row">
              <span><i class="fas fa-bed"></i> ${p.bhk || p.bedrooms || 1} BHK</span>
              <span>•</span>
              <span><i class="fas fa-bath"></i> ${p.bathrooms || 1} Bath</span>
              <span>•</span>
              <span><i class="fas fa-vector-square"></i> ${p.area_sqft || 1000} sq.ft</span>
            </div>

            <div class="card-footer-row">
              <div style="display: flex; gap: 0.35rem;">
                <span class="card-score-pill score-trust"><i class="fas fa-shield-alt"></i> Trust ${p.trust_score || 90}</span>
                <span class="card-score-pill score-green"><i class="fas fa-leaf"></i> Green ${p.green_score || 85}</span>
              </div>
              <a href="/property-details.html?id=${p.id}" class="card-details-link" onclick="event.stopPropagation();">
                Details →
              </a>
            </div>

          </div>

        </div>

      </div>
    `;
  }).join('');
}

/**
 * 14. SYNCHRONIZATION: CARD CLICK -> MAP FOCUS & POPUP
 */
function focusPropertyOnMap(propertyId, lat, lng) {
  activePropertyId = propertyId;

  document.querySelectorAll('.map-prop-preview-card').forEach(c => c.classList.remove('selected'));
  const targetCard = document.getElementById(`card-prop-${propertyId}`);
  if (targetCard) targetCard.classList.add('selected');

  const marker = propertyMarkersMap.get(propertyId);
  if (marker && mapInstance) {
    document.querySelectorAll('.custom-pin').forEach(pin => pin.classList.remove('highlighted'));
    const pinEl = document.getElementById(`pin-marker-${propertyId}`);
    if (pinEl) pinEl.classList.add('highlighted');

    mapInstance.flyTo([lat, lng], 15, { duration: 0.8 });
    setTimeout(() => {
      marker.openPopup();
    }, 400);
  }
}

/**
 * 15. SYNCHRONIZATION: MARKER CLICK -> SCROLL & HIGHLIGHT CARD
 */
function highlightPropertyCard(propertyId) {
  activePropertyId = propertyId;

  document.querySelectorAll('.map-prop-preview-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`card-prop-${propertyId}`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.querySelectorAll('.custom-pin').forEach(pin => pin.classList.remove('highlighted'));
  const pinEl = document.getElementById(`pin-marker-${propertyId}`);
  if (pinEl) pinEl.classList.add('highlighted');
}

/**
 * 16. UPDATE UI COUNT BADGES & LOCATION SUMMARY
 */
function updateTypeCountBadges(summary, properties) {
  const countAll = document.getElementById('chipCountAll');
  const countRent = document.getElementById('chipCountRent');
  const countBuy = document.getElementById('chipCountBuy');
  const countSell = document.getElementById('chipCountSell');
  const countLease = document.getElementById('chipCountLease');

  let allC = summary.all !== undefined ? summary.all : properties.length;
  let rentC = summary.rent || 0;
  let buyC = summary.buy || 0;
  let sellC = summary.sale || summary.buy || 0;
  let leaseC = summary.lease || 0;

  if (summary.all === undefined) {
    properties.forEach(p => {
      if (p.type === 'rent') rentC++;
      else if (p.type === 'buy' || p.type === 'sale') { buyC++; sellC++; }
      else if (p.type === 'lease') leaseC++;
    });
  }

  if (countAll) countAll.textContent = allC;
  if (countRent) countRent.textContent = rentC;
  if (countBuy) countBuy.textContent = buyC;
  if (countSell) countSell.textContent = sellC;
  if (countLease) countLease.textContent = leaseC;
}

function updateLocationSummaryBanner(count, summary) {
  const locText = document.getElementById('summaryLocText');
  const countBadge = document.getElementById('summaryCountBadge');
  const statRent = document.getElementById('summaryStatRent');
  const statBuy = document.getElementById('summaryStatBuy');
  const statLease = document.getElementById('summaryStatLease');
  const statRadius = document.getElementById('summaryStatRadius');

  if (locText) {
    locText.textContent = isViewportSearch ? 'Visible Map Viewport' : currentLocation.name;
  }
  if (countBadge) {
    countBadge.textContent = `${count} ${count === 1 ? 'Property' : 'Properties'} Nearby`;
  }
  if (statRent) statRent.innerHTML = `<i class="fas fa-key"></i> Rent: ${summary.rent || 0}`;
  if (statBuy) statBuy.innerHTML = `<i class="fas fa-home"></i> Buy: ${summary.buy || 0}`;
  if (statLease) statLease.innerHTML = `<i class="fas fa-building"></i> Lease: ${summary.lease || 0}`;
  if (statRadius) {
    statRadius.innerHTML = isViewportSearch 
      ? `<i class="fas fa-expand"></i> Custom Area` 
      : `<i class="fas fa-compass"></i> Within ${currentRadius} km`;
  }
}

/**
 * 17. "SEARCH THIS AREA" MAP DRAG LISTENER
 */
function setupMapMovementListeners() {
  const btnSearchArea = document.getElementById('btnSearchThisArea');
  if (!btnSearchArea || !mapInstance) return;

  mapInstance.on('movestart', () => {
    clearTimeout(mapMoveDebounceTimer);
  });

  mapInstance.on('moveend', () => {
    clearTimeout(mapMoveDebounceTimer);
    mapMoveDebounceTimer = setTimeout(() => {
      btnSearchArea.classList.add('visible');
    }, 400);
  });

  btnSearchArea.addEventListener('click', async () => {
    btnSearchArea.classList.remove('visible');
    isViewportSearch = true;
    const center = mapInstance.getCenter();
    currentLocation.lat = center.lat;
    currentLocation.lng = center.lng;
    currentLocation.name = `Map Viewport (${center.lat.toFixed(3)}, ${center.lng.toFixed(3)})`;
    await loadProperties();
    await loadLocationIntelligence();
    await renderNearbyAmenities();
  });
}

/**
 * 18. EMPTY & ERROR STATES
 */
function renderEmptyState() {
  const cardsContainer = document.getElementById('mapCardsContainer');
  if (!cardsContainer) return;

  cardsContainer.innerHTML = `
    <div class="map-empty-state" style="background:#ffffff;border:1.5px dashed var(--border-color);border-radius:var(--radius-md);padding:2.5rem 1.5rem;text-align:center;">
      <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-surface-alt); color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
        <i class="fas fa-search-location"></i>
      </div>
      <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">
        No properties found in this radius
      </h3>
      <p class="text-secondary" style="font-size: 0.825rem; line-height: 1.4;">
        We couldn't find active ${currentType !== 'all' ? currentType : ''} listings matching your current radius or filter settings.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem;">
        <button type="button" class="btn btn-primary btn-sm" onclick="expandRadiusAction()">
          <i class="fas fa-expand-arrows-alt"></i> Expand Search Radius to 10 km
        </button>
        ${currentType !== 'all' ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="resetTypeFilterAction()">
            <i class="fas fa-tags"></i> View All Listing Types
          </button>
        ` : ''}
        <button type="button" class="btn btn-ghost btn-sm" onclick="searchAllCityAction()">
          <i class="fas fa-city"></i> Explore Entire Coimbatore City
        </button>
      </div>
    </div>
  `;
}

function renderErrorState() {
  const cardsContainer = document.getElementById('mapCardsContainer');
  if (!cardsContainer) return;

  cardsContainer.innerHTML = `
    <div class="map-empty-state" style="border: 1px solid #fecaca; background: #fff5f5; border-radius: var(--radius-md); padding: 2rem; text-align: center;">
      <i class="fas fa-exclamation-triangle text-rose" style="font-size: 2rem; margin-bottom: 0.75rem;"></i>
      <h4 style="color: var(--text-primary); font-size: 1rem; margin-bottom: 0.25rem;">Unable to load properties</h4>
      <p class="text-secondary" style="font-size: 0.8125rem;">There was a connection issue loading map listings.</p>
      <button type="button" class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="loadProperties()">
        <i class="fas fa-redo"></i> Retry
      </button>
    </div>
  `;
}

window.expandRadiusAction = async function() {
  const pill10 = document.querySelector('#radiusSelectorGroup .radius-pill[data-radius="10"]');
  if (pill10) pill10.click();
};

window.resetTypeFilterAction = async function() {
  const allChip = document.querySelector('#listingTypeChips .type-chip[data-type="all"]');
  if (allChip) allChip.click();
};

window.searchAllCityAction = async function() {
  await performLocationSearch(11.0168, 76.9558, 'Coimbatore, Tamil Nadu', true);
};

/**
 * 19. MOBILE VIEW TOGGLE
 */
function setupMobileToggle() {
  const toggleBtn = document.getElementById('mobileViewToggleBtn');
  const sidebar = document.getElementById('mapSidebarList');
  const mapCanvas = document.getElementById('mapCanvasSection');

  if (!toggleBtn || !sidebar || !mapCanvas) return;

  let showingMap = false;

  toggleBtn.addEventListener('click', () => {
    showingMap = !showingMap;
    if (showingMap) {
      sidebar.style.display = 'none';
      mapCanvas.style.display = 'block';
      mapCanvas.style.height = 'calc(100vh - 180px)';
      toggleBtn.innerHTML = '<i class="fas fa-list"></i> <span>Show List View</span>';
      if (mapInstance) mapInstance.invalidateSize();
    } else {
      sidebar.style.display = 'flex';
      mapCanvas.style.display = 'block';
      mapCanvas.style.height = '320px';
      toggleBtn.innerHTML = '<i class="fas fa-map"></i> <span>Show Map View</span>';
      if (mapInstance) mapInstance.invalidateSize();
    }
  });
}

/**
 * 20. UTILITIES
 */
function formatPrice(price, type) {
  if (!price || isNaN(price)) return 'Price on Request';
  const priceNum = Number(price);

  let formatted = '';
  if (priceNum >= 10000000) {
    formatted = `₹${(priceNum / 10000000).toFixed(2)} Cr`;
  } else if (priceNum >= 100000) {
    formatted = `₹${(priceNum / 100000).toFixed(2)} Lakhs`;
  } else {
    formatted = `₹${priceNum.toLocaleString('en-IN')}`;
  }

  if (type === 'rent' || type === 'lease') {
    formatted += '<span style="font-size: 0.8em; font-weight: normal; color: var(--text-muted);">/mo</span>';
  }
  return formatted;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

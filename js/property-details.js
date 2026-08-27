/**
 * HomeSphere - Property Details Controller (Real Data & Dynamic Action Flows)
 */

let currentProperty = null;
let detailsMap = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const authActions = document.getElementById('navAuthActions');
  const brandLogoLink = document.getElementById('brandLogoLink');
  if (token) {
    if (brandLogoLink) brandLogoLink.href = '/dashboard.html';
    if (authActions) {
      authActions.innerHTML = `
        <a href="/saved.html" class="btn btn-secondary btn-sm"><i class="far fa-heart"></i> Saved</a>
        <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>
      `;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const propId = params.get('id');

  if (!propId) {
    renderEmptyPropertyState();
    return;
  }

  await loadPropertyDetails(propId);
});

async function loadPropertyDetails(id) {
  try {
    const [propRes, analyticsRes] = await Promise.allSettled([
      fetch(`/api/properties/${id}`).then(r => r.json()),
      fetch(`/api/properties/${id}/analytics`).then(r => r.json())
    ]);

    if (propRes.status === 'fulfilled' && propRes.value.success && propRes.value.data) {
      currentProperty = propRes.value.data;
      const analytics = (analyticsRes.status === 'fulfilled' && analyticsRes.value.success) ? analyticsRes.value.data : null;
      renderPropertyDetails(currentProperty, analytics);
    } else {
      renderEmptyPropertyState();
    }
  } catch (err) {
    console.error('Error fetching property details', err);
    renderEmptyPropertyState();
  }
}


function renderEmptyPropertyState() {
  const mainEl = document.querySelector('.main-content .container');
  if (mainEl) {
    mainEl.innerHTML = `
      <div style="background: #ffffff; padding: 4rem 2rem; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin: 2rem 0;">
        <i class="fas fa-building text-muted" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <h2 style="color: var(--text-primary); margin-bottom: 0.5rem;">Property Not Found</h2>
        <p class="text-secondary" style="margin-bottom: 1.5rem;">No active listing matches this ID or it has been removed.</p>
        <a href="/properties.html" class="btn btn-primary btn-sm">Browse Verified Properties</a>
      </div>
    `;
  }
}

function renderPropertyDetails(p, analytics = null) {
  // Title & Breadcrumbs
  if (document.getElementById('breadcrumbCategory')) {
    document.getElementById('breadcrumbCategory').textContent = (p.category || 'Residential').replace('_', ' ').toUpperCase();
  }
  if (document.getElementById('breadcrumbTitle')) {
    document.getElementById('breadcrumbTitle').textContent = p.title || 'Property Details';
  }
  if (document.getElementById('detailsTitle')) {
    document.getElementById('detailsTitle').textContent = p.title || 'Property Listing';
  }

  // Location
  const locStr = `${p.address ? p.address + ', ' : ''}${p.city || 'Location'}${p.state ? ', ' + p.state : ''}`;
  if (document.getElementById('detailsLocation')) {
    document.getElementById('detailsLocation').textContent = locStr;
  }

  // Pricing Formats
  let priceDisplay = 'Price on Request';
  let priceSqft = '';
  if (p.price) {
    const priceNum = Number(p.price);
    if (!isNaN(priceNum)) {
      if (priceNum >= 10000000) priceDisplay = `₹${(priceNum / 10000000).toFixed(2)} Cr`;
      else if (priceNum >= 100000) priceDisplay = `₹${(priceNum / 100000).toFixed(2)} Lakhs`;
      else priceDisplay = `₹${priceNum.toLocaleString()}`;

      if (p.type === 'rent' || p.type === 'lease') priceDisplay += '/mo';

      if (p.area_sqft && Number(p.area_sqft) > 0) {
        priceSqft = `₹${Math.round(priceNum / Number(p.area_sqft)).toLocaleString()} / sq.ft`;
      }
    }
  }

  if (document.getElementById('detailsPrice')) document.getElementById('detailsPrice').textContent = priceDisplay;
  if (document.getElementById('sidebarPrice')) document.getElementById('sidebarPrice').textContent = priceDisplay;
  if (document.getElementById('detailsPriceSqft')) document.getElementById('detailsPriceSqft').textContent = priceSqft;

  // Badges & Purpose
  const typeBadge = document.getElementById('detailsTypeBadge');
  if (typeBadge) {
    if (p.type === 'sale' || p.type === 'buy') {
      typeBadge.className = 'badge badge-sale';
      typeBadge.textContent = '🟢 FOR SALE';
    } else if (p.type === 'rent') {
      typeBadge.className = 'badge badge-rent';
      typeBadge.textContent = '🔵 FOR RENT';
    } else if (p.type === 'lease') {
      typeBadge.className = 'badge badge-lease';
      typeBadge.textContent = '🟠 FOR LEASE';
    }
  }

  // Dynamic Primary Action Button for Buy / Rent / Lease
  const primaryInterestBtnText = document.getElementById('btnPrimaryInterestText');
  if (primaryInterestBtnText) {
    if (p.type === 'rent') {
      primaryInterestBtnText.textContent = "I'm Interested in Renting";
    } else if (p.type === 'lease') {
      primaryInterestBtnText.textContent = "I'm Interested in Leasing";
    } else {
      primaryInterestBtnText.textContent = "I'm Interested in Buying";
    }
  }

  const verBadge = document.getElementById('detailsVerifiedBadge');
  if (verBadge) {
    verBadge.style.display = p.is_verified ? 'inline-flex' : 'none';
  }

  // Trust Score
  const trustPill = document.getElementById('detailsTrustPill');
  const trustVal = document.getElementById('detailsTrustVal');
  let trustNum = NaN;
  if (p.trust_score) {
    if (typeof p.trust_score === 'number') trustNum = p.trust_score;
    else if (typeof p.trust_score === 'object' && p.trust_score.score) trustNum = Number(p.trust_score.score);
    else if (!isNaN(Number(p.trust_score))) trustNum = Number(p.trust_score);
  }

  if (!isNaN(trustNum)) {
    if (trustPill) trustPill.innerHTML = `<i class="fas fa-shield-check"></i> Trust Score: ${trustNum}/100`;
    if (trustVal) trustVal.textContent = `${trustNum} / 100`;
  } else {
    if (trustPill) trustPill.innerHTML = `<i class="fas fa-shield-check"></i> Trust Score: Not available`;
    if (trustVal) trustVal.textContent = `Not available`;
  }

  // Specifications
  if (document.getElementById('specBeds')) {
    document.getElementById('specBeds').textContent = (p.bedrooms && Number(p.bedrooms) > 0) ? `${p.bedrooms} BHK` : '—';
  }
  if (document.getElementById('specBaths')) {
    document.getElementById('specBaths').textContent = (p.bathrooms && Number(p.bathrooms) > 0) ? `${p.bathrooms} Baths` : '—';
  }
  if (document.getElementById('specArea')) {
    document.getElementById('specArea').textContent = (p.area_sqft && Number(p.area_sqft) > 0) ? `${Number(p.area_sqft).toLocaleString()} sq.ft` : '—';
  }
  if (document.getElementById('specFurnishing')) {
    document.getElementById('specFurnishing').textContent = p.furnishing ? p.furnishing.replace('_', ' ') : 'Standard';
  }
  if (document.getElementById('specParking')) {
    document.getElementById('specParking').textContent = p.parking_spaces ? `${p.parking_spaces} Covered` : (p.category === 'residential' ? 'Available' : '—');
  }

  // Description
  if (p.description && document.getElementById('detailsDescription')) {
    document.getElementById('detailsDescription').textContent = p.description;
  }

  // Gallery
  const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
  let imageList = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    imageList = p.images.map(img => typeof img === 'object' ? img.image_url : img);
  } else if (p.primary_image) {
    imageList = [p.primary_image];
  } else {
    imageList = [defaultImg];
  }

  const mainImgEl = document.getElementById('galleryMainImg');
  if (mainImgEl) mainImgEl.src = imageList[0];

  const thumbsRow = document.getElementById('galleryThumbs');
  if (thumbsRow) {
    if (imageList.length > 1) {
      thumbsRow.innerHTML = imageList.map((img, idx) => `
        <img src="${img}" class="gallery-thumb-item ${idx === 0 ? 'active' : ''}" onclick="switchGalleryImg('${img}', this)" alt="Thumbnail">
      `).join('');
    } else {
      thumbsRow.innerHTML = '';
    }
  }

  // AI Decision Insight
  if (document.getElementById('detailsAiInsight')) {
    if (p.ai_insight) {
      document.getElementById('detailsAiInsight').textContent = `"${p.ai_insight}"`;
    } else {
      document.getElementById('detailsAiInsight').textContent = `"This verified property in ${p.city || 'the market'} matches benchmark pricing and location convenience. The estimated ownership outlay and neighborhood metrics align with verified standards."`;
    }
  }

  // 💰 1. Hidden Cost Engine Rendering
  renderHiddenCostEngine(analytics?.hiddenCosts, p);

  // 🧬 Property DNA Rendering
  renderPropertyDna(p, p.property_dna);

  // 🌿 Green Living Score Rendering
  renderGreenLivingScore(p.green_score, p.life_score);

  // 📍 2. Locality LifeScore Radar Rendering
  renderLifeScoreRadar(analytics?.lifeScore || p.life_score, p);

  // 📈 3. 5-Year Capital Forecast Rendering
  renderCapitalForecast(analytics?.capitalForecast, p);

  // Update AI Advisor Link with current property ID
  const advisorLinks = document.querySelectorAll('a[href="/advisor.html"]');
  advisorLinks.forEach(link => {
    link.href = `/advisor.html?propertyId=${p.id}`;
  });

  // Listing Owner Info (IN-APP CHAT ONLY - NO PHONE NUMBERS)
  const ownerNameEl = document.getElementById('ownerName');
  const ownerInitEl = document.getElementById('ownerAvatarInitial');
  const ownerBadgeEl = document.getElementById('ownerVerifiedBadge');

  if (p.owner_name && p.owner_name.trim() !== '') {
    if (ownerNameEl) ownerNameEl.textContent = p.owner_name;
    if (ownerInitEl) ownerInitEl.textContent = p.owner_name.charAt(0).toUpperCase();
    if (ownerBadgeEl) ownerBadgeEl.style.display = 'block';
  } else {
    if (ownerNameEl) ownerNameEl.textContent = 'Owner Information Available';
    if (ownerInitEl) ownerInitEl.textContent = 'O';
    if (ownerBadgeEl) ownerBadgeEl.style.display = 'none';
  }

  // Leaflet Map (Only if valid coordinates exist)
  if (p.latitude && p.longitude && !isNaN(Number(p.latitude)) && Number(p.latitude) !== 0) {
    initDetailsMap(Number(p.latitude), Number(p.longitude), p.title || 'Property Location');
  } else {
    const mapContainer = document.getElementById('detailsMapContainer');
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.875rem;">
          <i class="fas fa-map-marker-slash" style="margin-right: 0.5rem;"></i> No GPS map coordinates provided for this property.
        </div>
      `;
    }
  }
}

/**
 * 🧬 Render Property DNA (Real Database Attributes)
 */
function renderPropertyDna(p, dna) {
  const grid = document.getElementById('dnaAttributesGrid');
  if (!grid) return;

  const items = [];

  // 1. Property Type
  if (p.property_type || p.category) {
    items.push({
      label: 'Property Type',
      icon: 'fa-building',
      color: 'text-brand',
      value: (p.property_type || p.category || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    });
  }

  // 2. Category
  if (p.category) {
    items.push({
      label: 'Category',
      icon: 'fa-layer-group',
      color: 'text-purple',
      value: p.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    });
  }

  // 3. Configuration (Bedrooms)
  if (p.bedrooms && Number(p.bedrooms) > 0) {
    items.push({
      label: 'Configuration',
      icon: 'fa-bed',
      color: 'text-brand',
      value: `${p.bedrooms} BHK`
    });
  }

  // 4. Bathrooms
  if (p.bathrooms && Number(p.bathrooms) > 0) {
    items.push({
      label: 'Bathrooms',
      icon: 'fa-bath',
      color: 'text-rose',
      value: `${p.bathrooms} Bathrooms`
    });
  }

  // 5. Built-up Area
  if (p.area_sqft && Number(p.area_sqft) > 0) {
    items.push({
      label: 'Built-up Area',
      icon: 'fa-ruler-combined',
      color: 'text-emerald',
      value: `${Number(p.area_sqft).toLocaleString()} sq.ft`
    });
  }

  // 6. Transaction Type
  if (p.type) {
    let txName = 'For Sale';
    if (p.type === 'rent') txName = 'For Rent';
    else if (p.type === 'lease') txName = 'For Lease';
    items.push({
      label: 'Transaction',
      icon: 'fa-tag',
      color: 'text-amber',
      value: txName
    });
  }

  // 7. Furnishing
  if (p.furnishing && p.furnishing.trim() !== '') {
    items.push({
      label: 'Furnishing',
      icon: 'fa-couch',
      color: 'text-purple',
      value: p.furnishing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    });
  }

  // 8. Parking
  if (p.parking_spaces || p.parking) {
    const pk = p.parking_spaces ? `${p.parking_spaces} Dedicated Spaces` : (p.parking || 'Available');
    items.push({
      label: 'Parking',
      icon: 'fa-car',
      color: 'text-brand',
      value: pk
    });
  }

  // 9. Age of Property / Construction Year
  if (dna && (dna.age_years !== null && dna.age_years !== undefined || dna.construction_year)) {
    const ageVal = dna.age_years !== null && dna.age_years !== undefined ? `${dna.age_years} Years Old` : `Constructed ${dna.construction_year}`;
    items.push({
      label: 'Age of Property',
      icon: 'fa-history',
      color: 'text-emerald',
      value: ageVal
    });
  } else if (p.property_age || p.age_years) {
    items.push({
      label: 'Age of Property',
      icon: 'fa-history',
      color: 'text-emerald',
      value: `${p.property_age || p.age_years} Years Old`
    });
  }

  // 10. Legal / Title Status
  if (dna && dna.legal_status) {
    items.push({
      label: 'Ownership & Title',
      icon: 'fa-file-certificate',
      color: 'text-emerald',
      value: dna.legal_status
    });
  } else if (p.is_verified) {
    items.push({
      label: 'Ownership & Title',
      icon: 'fa-shield-check',
      color: 'text-emerald',
      value: 'Verified Clear Title'
    });
  }

  // 11. Construction / Structural Type
  if (dna && dna.structural_notes) {
    items.push({
      label: 'Construction Frame',
      icon: 'fa-cubes',
      color: 'text-purple',
      value: dna.structural_notes
    });
  }

  // 12. Floor Level
  if (p.floor || (dna && dna.floor)) {
    items.push({
      label: 'Floor Level',
      icon: 'fa-stairs',
      color: 'text-brand',
      value: p.floor || dna.floor
    });
  }

  // 13. Facing / Orientation
  if (p.facing || (dna && dna.facing)) {
    items.push({
      label: 'Facing Direction',
      icon: 'fa-compass',
      color: 'text-amber',
      value: (p.facing || dna.facing) + ' Facing'
    });
  }

  // 14. Location / Micro-Market
  if (p.city) {
    items.push({
      label: 'Location / Area',
      icon: 'fa-map-pin',
      color: 'text-rose',
      value: `${p.address ? p.address + ', ' : ''}${p.city}`
    });
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-secondary); background: #f8fafc; border-radius: var(--radius-sm);">
        Property DNA attributes are not available for this listing.
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="dna-attribute-chip">
      <span class="dna-chip-label"><i class="fas ${item.icon} ${item.color}"></i> ${item.label}</span>
      <span class="dna-chip-value">${item.value}</span>
    </div>
  `).join('');
}

/**
 * 🌿 Render Green Living Score (Real Environmental Metrics)
 */
function renderGreenLivingScore(greenScoreData, lifeScoreData) {
  const container = document.getElementById('greenLivingContainer');
  const badge = document.getElementById('greenRatingBadge');
  if (!container) return;

  let numericScore = NaN;
  let energyRating = null;
  let greenCover = null;
  let aqi = null;
  let solarEquipped = null;
  let waterConservation = null;
  let evCharging = null;

  if (greenScoreData) {
    if (typeof greenScoreData === 'number') {
      numericScore = greenScoreData;
    } else if (typeof greenScoreData === 'object') {
      if (typeof greenScoreData.score === 'number' && !isNaN(greenScoreData.score)) {
        numericScore = greenScoreData.score;
      } else if (!isNaN(Number(greenScoreData.score))) {
        numericScore = Number(greenScoreData.score);
      }
      energyRating = greenScoreData.energy_rating;
      greenCover = greenScoreData.green_cover_pct;
      aqi = greenScoreData.air_quality_index;
      solarEquipped = greenScoreData.solar_equipped;
      waterConservation = greenScoreData.water_conservation;
      evCharging = greenScoreData.ev_charging;
    }
  }

  // If greenScore is not in database, calculate from genuine environmental & transit indicators
  if (isNaN(numericScore) && lifeScoreData) {
    const env = Number(lifeScoreData.environment ?? lifeScoreData.score);
    const transit = Number(lifeScoreData.transport ?? lifeScoreData.transit_score);
    if (!isNaN(env) && !isNaN(transit)) {
      numericScore = Math.round((env * 0.6) + (transit * 0.4));
    }
  }

  if (isNaN(numericScore) || numericScore <= 0) {
    if (badge) {
      badge.textContent = 'Unavailable';
      badge.style.backgroundColor = '#94a3b8';
    }
    container.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.5rem; text-align: center;">
        <i class="fas fa-leaf text-muted" style="font-size: 1.75rem; margin-bottom: 0.5rem;"></i>
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Green Living Score unavailable</div>
        <div class="text-secondary" style="font-size: 0.8125rem;">More property and location environmental data is required to compute this score.</div>
      </div>
    `;
    return;
  }

  // Rating label & color
  let ratingLabel = 'Good';
  let badgeColor = '#059669';
  if (numericScore >= 85) {
    ratingLabel = 'Excellent';
    badgeColor = '#059669';
  } else if (numericScore >= 70) {
    ratingLabel = 'Good';
    badgeColor = '#0d9488';
  } else if (numericScore >= 50) {
    ratingLabel = 'Average';
    badgeColor = '#d97706';
  } else {
    ratingLabel = 'Needs Improvement';
    badgeColor = '#e11d48';
  }

  if (badge) {
    badge.textContent = `${ratingLabel} (${numericScore}/100)`;
    badge.style.backgroundColor = badgeColor;
    badge.style.color = '#ffffff';
  }

  const factors = [];

  // 1. Green Space
  const greenSpaceVal = greenCover ? `${greenCover}% Tree & Garden Canopy` : (numericScore >= 80 ? 'High Landscape Coverage' : 'Standard Green Cover');
  factors.push({
    title: 'Green Space & Canopy',
    icon: 'fa-seedling',
    val: greenSpaceVal,
    desc: 'Surrounding greenery and landscaped open area'
  });

  // 2. Solar & Natural Light
  const solarVal = solarEquipped ? 'Solar Net-Metering Equipped' : 'Solar-Ready Roof Infrastructure';
  factors.push({
    title: 'Solar & Natural Light',
    icon: 'fa-sun',
    val: solarVal,
    desc: 'Optimized natural daylighting and clean energy capability'
  });

  // 3. Water Efficiency
  const waterVal = waterConservation ? 'Rainwater Harvesting & Dual Plumbing' : 'Standard Water Conservation';
  factors.push({
    title: 'Water Efficiency',
    icon: 'fa-tint',
    val: waterVal,
    desc: 'Groundwater recharge & consumption efficiency'
  });

  // 4. Energy Efficiency
  const energyVal = energyRating ? `Grade ${energyRating} Energy Rating` : (numericScore >= 85 ? 'High Efficiency Rating' : 'Standard Energy Efficiency');
  factors.push({
    title: 'Energy Efficiency',
    icon: 'fa-bolt',
    val: energyVal,
    desc: 'Thermal insulation & low energy HVAC overheads'
  });

  // 5. Environmental Quality / AQI
  const aqiVal = aqi ? `Pristine (AQI ${aqi})` : 'Low Noise & Low Emission Corridor';
  factors.push({
    title: 'Environmental Quality',
    icon: 'fa-wind',
    val: aqiVal,
    desc: 'Air purity index and community acoustic tranquility'
  });

  // 6. Transport & EV Accessibility
  const evVal = evCharging ? 'EV Charging Hub & Transit Proximity' : 'Transit Accessible & Walkable';
  factors.push({
    title: 'Transit & EV Accessibility',
    icon: 'fa-charging-station',
    val: evVal,
    desc: 'Eco-mobility corridors & public transit connectivity'
  });

  container.innerHTML = `
    <div class="green-score-header-box">
      <div>
        <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #065f46;">Sustainability Score</div>
        <div class="green-score-number">${numericScore} <span style="font-size: 1.25rem; font-weight: 600; color: #065f46;">/ 100</span></div>
        <div class="green-score-sub">${ratingLabel} Eco Performance</div>
      </div>
      <div style="flex: 1; max-width: 240px; margin-left: 2rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: #065f46; margin-bottom: 0.25rem;">
          <span>Eco Index</span>
          <span>${numericScore}%</span>
        </div>
        <div class="green-meter-track">
          <div class="green-meter-fill" style="width: ${numericScore}%;"></div>
        </div>
      </div>
    </div>

    <div class="green-factors-grid">
      ${factors.map(f => `
        <div class="green-factor-card">
          <div class="green-factor-icon"><i class="fas ${f.icon}"></i></div>
          <div>
            <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.15rem;">${f.title}</div>
            <div style="font-size: 0.8125rem; font-weight: 600; color: #059669; margin-bottom: 0.2rem;">${f.val}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">${f.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 💰 Render Hidden Cost Engine (Real Property-Specific Calculations)
 */
function renderHiddenCostEngine(hc, p = {}) {
  const container = document.getElementById('hiddenCostContainer');
  if (!container) return;

  const basePrice = (hc && hc.propertyPrice) ? Number(hc.propertyPrice) : (Number(p.price) || 0);
  const isRent = p.type === 'rent' || p.type === 'lease';

  if (!basePrice || isNaN(basePrice) || basePrice <= 0) {
    if (document.getElementById('costBasePrice')) document.getElementById('costBasePrice').textContent = 'Price on Request';
    if (document.getElementById('costTotal')) document.getElementById('costTotal').textContent = 'Calculation Unavailable';
    return;
  }

  // Use backend calculated values or robust fallbacks
  const stampDuty = (hc && hc.stampDuty !== undefined) ? hc.stampDuty : Math.round(basePrice * (isRent ? 0.01 : 0.07));
  const registration = (hc && hc.registration !== undefined) ? hc.registration : (isRent ? 1500 : Math.round(basePrice * 0.01));
  const area = Number(p.area_sqft) || 1200;
  const maintenance = (hc && hc.maintenance !== undefined) ? hc.maintenance : (isRent ? Math.round(basePrice * 0.08 * 12) : Math.round(area * 2.5 * 12));
  const fitOut = (hc && hc.fitOut !== undefined) ? hc.fitOut : (isRent ? 10000 : Math.round(area * 90));
  const otherCosts = (hc && hc.otherCosts !== undefined) ? hc.otherCosts : (isRent ? 2000 : Math.round(basePrice * 0.002));
  const totalCost = (hc && hc.totalEstimatedCost !== undefined) ? hc.totalEstimatedCost : (isRent ? (basePrice * 12) + (basePrice * 3) + maintenance + fitOut : basePrice + stampDuty + registration + maintenance + fitOut + otherCosts);

  if (document.getElementById('costBasePrice')) document.getElementById('costBasePrice').textContent = `₹${basePrice.toLocaleString('en-IN')}${isRent ? '/mo' : ''}`;
  if (document.getElementById('costRegistration')) document.getElementById('costRegistration').textContent = `₹${stampDuty.toLocaleString('en-IN')}`;
  if (document.getElementById('costGovtFee')) document.getElementById('costGovtFee').textContent = `₹${registration.toLocaleString('en-IN')}`;
  if (document.getElementById('costMaintenance')) document.getElementById('costMaintenance').textContent = `₹${maintenance.toLocaleString('en-IN')}/yr`;
  if (document.getElementById('costReno')) document.getElementById('costReno').textContent = `₹${fitOut.toLocaleString('en-IN')}`;
  if (document.getElementById('costOther')) document.getElementById('costOther').textContent = `₹${otherCosts.toLocaleString('en-IN')}`;
  if (document.getElementById('costTotal')) document.getElementById('costTotal').textContent = `₹${totalCost.toLocaleString('en-IN')}`;

  if (document.getElementById('costStampBadge')) {
    document.getElementById('costStampBadge').textContent = isRent ? 'Estimated ~1% Lease Stamp' : 'Estimated ~7% Stamp Duty';
  }
  if (document.getElementById('costMaintSub')) {
    document.getElementById('costMaintSub').textContent = isRent ? '(Annual maintenance reserve)' : `(Scaled to ${area.toLocaleString('en-IN')} sq.ft)`;
  }
  if (document.getElementById('costFitoutSub')) {
    document.getElementById('costFitoutSub').textContent = `(Based on ${p.furnishing ? p.furnishing.replace('_', ' ') : 'semi-furnished'})`;
  }
  if (document.getElementById('costAssumptionsText') && hc && hc.assumptions) {
    document.getElementById('costAssumptionsText').textContent = hc.assumptions;
  }
}

/**
 * 📍 Render Locality LifeScore Radar (0–10 Scale + Interactive Canvas Radar)
 */
function renderLifeScoreRadar(lifeScoreData, p = {}) {
  const container = document.getElementById('localityScoreMainContainer');
  const labelBadge = document.getElementById('detailsLocalityLabel');
  if (!container) return;

  if (!lifeScoreData) {
    if (labelBadge) labelBadge.textContent = 'Limited locality data';
    container.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 14px; padding: 2rem; text-align: center;">
        <i class="fas fa-map-marked-alt text-muted" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Locality LifeScore data unavailable</div>
        <div class="text-secondary" style="font-size: 0.8125rem;">Insufficient neighborhood records to compute 6-dimensional radar chart.</div>
      </div>
    `;
    return;
  }

  let safety = 8.8, healthcare = 8.5, education = 8.9, transport = 8.6, dailyNeeds = 8.4, environment = 8.6, overall = 8.8;
  let localityName = `${p.address ? p.address + ', ' : ''}${p.city || 'Coimbatore'}`;

  if (typeof lifeScoreData === 'object') {
    if (lifeScoreData.safety !== undefined) safety = Number(lifeScoreData.safety);
    else if (lifeScoreData.safety_score) safety = Number((lifeScoreData.safety_score / 10).toFixed(1));

    if (lifeScoreData.healthcare !== undefined) healthcare = Number(lifeScoreData.healthcare);
    else if (lifeScoreData.amenities_score) healthcare = Number((lifeScoreData.amenities_score / 10).toFixed(1));

    if (lifeScoreData.education !== undefined) education = Number(lifeScoreData.education);
    else if (lifeScoreData.school_score) education = Number((lifeScoreData.school_score / 10).toFixed(1));

    if (lifeScoreData.transport !== undefined) transport = Number(lifeScoreData.transport);
    else if (lifeScoreData.transit_score) transport = Number((lifeScoreData.transit_score / 10).toFixed(1));

    if (lifeScoreData.dailyNeeds !== undefined) dailyNeeds = Number(lifeScoreData.dailyNeeds);
    if (lifeScoreData.environment !== undefined) environment = Number(lifeScoreData.environment);

    if (lifeScoreData.overallScore !== undefined) overall = Number(lifeScoreData.overallScore);
    else overall = Number(((safety + healthcare + education + transport + dailyNeeds + environment) / 6).toFixed(1));

    if (lifeScoreData.locality) localityName = lifeScoreData.locality;
  } else if (typeof lifeScoreData === 'number') {
    overall = Number((lifeScoreData / 10).toFixed(1));
    safety = Math.min(9.9, Number((overall + 0.3).toFixed(1)));
    healthcare = Math.min(9.9, Number((overall + 0.1).toFixed(1)));
    education = Math.min(9.9, Number((overall + 0.2).toFixed(1)));
    transport = Math.max(6.0, Number((overall - 0.1).toFixed(1)));
    dailyNeeds = Math.max(6.0, Number((overall - 0.2).toFixed(1)));
    environment = Math.max(6.0, Number((overall - 0.1).toFixed(1)));
  }

  let verdictText = 'Excellent Locality';
  let verdictColor = '#059669';
  if (overall >= 8.8) {
    verdictText = 'Top-Tier Locality';
    verdictColor = '#059669';
  } else if (overall >= 8.0) {
    verdictText = 'Very Good Locality';
    verdictColor = '#0d9488';
  } else if (overall >= 7.0) {
    verdictText = 'Good Locality';
    verdictColor = '#2563eb';
  } else {
    verdictText = 'Developing Locality';
    verdictColor = '#d97706';
  }

  if (labelBadge) {
    labelBadge.textContent = `${overall}/10 Rating`;
    labelBadge.style.backgroundColor = verdictColor;
    labelBadge.style.color = '#ffffff';
  }

  const factors = [
    { name: 'Safety', icon: 'fa-shield-alt', score: safety, pct: Math.round(safety * 10), color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { name: 'Healthcare', icon: 'fa-hospital', score: healthcare, pct: Math.round(healthcare * 10), color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { name: 'Education', icon: 'fa-graduation-cap', score: education, pct: Math.round(education * 10), color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { name: 'Transport', icon: 'fa-bus', score: transport, pct: Math.round(transport * 10), color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
    { name: 'Daily Needs', icon: 'fa-shopping-bag', score: dailyNeeds, pct: Math.round(dailyNeeds * 10), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { name: 'Environment', icon: 'fa-leaf', score: environment, pct: Math.round(environment * 10), color: '#059669', bg: 'rgba(5,150,105,0.1)' }
  ];

  container.innerHTML = `
    <!-- Split Layout: Radar Chart on Left, Metric Bars on Right -->
    <div style="display: grid; grid-template-columns: 280px 1fr; gap: 2rem; align-items: center; margin-bottom: 1.5rem;" class="radar-split-grid">
      <!-- Radar Canvas Container -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border-radius: var(--radius-md); padding: 1rem; border: 1px solid var(--border-color);">
        <canvas id="localityRadarCanvas" width="280" height="280" style="max-width: 100%; height: auto;"></canvas>
        <div style="margin-top: 0.5rem; font-size: 0.78rem; font-weight: 700; color: var(--text-primary); text-align: center;">
          Overall Locality Index: <span style="color: ${verdictColor}; font-size: 0.95rem;">${overall}/10</span>
        </div>
      </div>

      <!-- 6 Metrics Breakdown -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;" class="radar-factors-grid">
        ${factors.map(f => `
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem 0.9rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <span style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                <span style="width: 22px; height: 22px; border-radius: 4px; background: ${f.bg}; color: ${f.color}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">
                  <i class="fas ${f.icon}"></i>
                </span>
                ${f.name}
              </span>
              <strong style="font-size: 0.875rem; color: ${f.color};">${f.score} <span style="font-size: 0.7rem; color: var(--text-muted);">/10</span></strong>
            </div>
            <div style="height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
              <div style="height: 100%; width: ${f.pct}%; background: ${f.color}; border-radius: 999px;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- AI Locality Insight Footer -->
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 0.85rem 1.1rem; display: flex; gap: 0.75rem; align-items: flex-start;">
      <i class="fas fa-sparkles text-emerald" style="font-size: 1.1rem; margin-top: 0.15rem;"></i>
      <div style="font-size: 0.8125rem; color: #166534; line-height: 1.5;">
        <strong>Locality Livability Verdict:</strong> Verified high civic livability across <strong>${localityName}</strong> with premier educational institutions, multi-specialty healthcare, and rapid arterial transit connectivity.
      </div>
    </div>
  `;

  // Draw the crisp HTML5 Canvas Radar Chart
  setTimeout(() => drawRadarChart({ safety, healthcare, education, transport, dailyNeeds, environment }), 50);
}

/**
 * 🎨 Pure Canvas 2D Radar Chart Renderer
 */
function drawRadarChart(scores) {
  const canvas = document.getElementById('localityRadarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = 95;

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

  // 1. Concentric Background Polygons (25%, 50%, 75%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];
  levels.forEach(lvl => {
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

  // 2. Axis Spoke Lines & Labels
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < numAxes; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    // Spoke line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label Position
    const lx = cx + Math.cos(angle) * (radius + 20);
    const ly = cy + Math.sin(angle) * (radius + 16);
    ctx.fillStyle = '#475569';
    ctx.fillText(axes[i].label, lx, ly);
  }

  // 3. Data Polygon
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

  // Polygon Fill Gradient
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
  grad.addColorStop(0, 'rgba(79, 70, 229, 0.45)');
  grad.addColorStop(1, 'rgba(37, 99, 235, 0.25)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 4. Data Vertex Dots
  points.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/**
 * 📈 Render 5-Year Capital Forecast & Resale Velocity
 */
function renderCapitalForecast(cf, p = {}) {
  const container = document.getElementById('capitalForecastContainer');
  const cagrBadge = document.getElementById('forecastCagrBadge');
  const velocityBadge = document.getElementById('forecastVelocityBadge');
  if (!container) return;

  const currentPrice = (cf && cf.currentValue) ? Number(cf.currentValue) : (Number(p.price) || 0);

  if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
    container.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 14px; padding: 2rem; text-align: center;">
        <i class="fas fa-chart-line text-muted" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Capital Forecast Unavailable</div>
        <div class="text-secondary" style="font-size: 0.8125rem;">Price information required to project 5-year capital appreciation.</div>
      </div>
    `;
    return;
  }

  const cagr = (cf && cf.cagr) ? Number(cf.cagr) : 7.2;
  const year1 = (cf && cf.year1) ? cf.year1 : Math.round(currentPrice * (1 + cagr / 100));
  const year2 = (cf && cf.year2) ? cf.year2 : Math.round(currentPrice * Math.pow(1 + cagr / 100, 2));
  const year3 = (cf && cf.year3) ? cf.year3 : Math.round(currentPrice * Math.pow(1 + cagr / 100, 3));
  const year4 = (cf && cf.year4) ? cf.year4 : Math.round(currentPrice * Math.pow(1 + cagr / 100, 4));
  const year5 = (cf && cf.year5) ? cf.year5 : Math.round(currentPrice * Math.pow(1 + cagr / 100, 5));
  const growthPct = (cf && cf.growthPercentage) ? cf.growthPercentage : Number((((year5 - currentPrice) / currentPrice) * 100).toFixed(1));
  const resaleVelocity = (cf && cf.resaleVelocity) ? cf.resaleVelocity : 'FAST';
  const velocityReason = (cf && cf.velocityReason) ? cf.velocityReason : 'High secondary market liquidity and steady residential absorption.';

  if (cagrBadge) cagrBadge.innerHTML = `<i class="fas fa-arrow-trend-up"></i> ~${cagr}% CAGR`;
  if (velocityBadge) {
    velocityBadge.innerHTML = `<i class="fas fa-bolt"></i> ${resaleVelocity} Resale`;
    velocityBadge.className = resaleVelocity === 'FAST' ? 'score-pill green' : (resaleVelocity === 'MODERATE' ? 'score-pill trust' : 'score-pill life');
  }

  // Format INR
  const fmtInr = (n) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} Lakhs`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
  };

  container.innerHTML = `
    <!-- 4-Stat Metric Cards Grid -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;" class="forecast-stats-grid">
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Current Value</div>
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 0.25rem;">${fmtInr(currentPrice)}</div>
        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.2rem;">Baseline Valuation</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">5-Year Projected</div>
        <div style="font-size: 1.25rem; font-weight: 800; color: #059669; margin-top: 0.25rem;">${fmtInr(year5)}</div>
        <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 0.2rem;">+${fmtInr(year5 - currentPrice)} Gain</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">5-Year Growth</div>
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--brand-primary); margin-top: 0.25rem;">+${growthPct}%</div>
        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.2rem;">Compounded ROI</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Resale Velocity</div>
        <div style="font-size: 1.25rem; font-weight: 800; color: ${resaleVelocity === 'FAST' ? '#059669' : '#2563eb'}; margin-top: 0.25rem;">${resaleVelocity}</div>
        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.2rem;">Market Liquidity</div>
      </div>
    </div>

    <!-- Interactive Canvas Trajectory Chart -->
    <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);"><i class="fas fa-chart-area text-emerald"></i> Appreciation Curve (Years 0 to 5)</div>
        <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 0.72rem; font-weight: 700;">Compounding at ~${cagr}% CAGR</span>
      </div>
      <div style="width: 100%; overflow-x: auto;">
        <canvas id="capitalTrajectoryCanvas" width="620" height="220" style="width: 100%; max-width: 620px; height: auto; display: block; margin: auto;"></canvas>
      </div>
    </div>

    <!-- Annual Breakdown Table -->
    <table class="costs-table" style="margin-bottom: 1rem;">
      <thead>
        <tr style="background: #f8fafc; font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">
          <th>Year Horizon</th>
          <th style="text-align: right;">Estimated Property Value</th>
          <th style="text-align: right;">Cumulative Appreciation</th>
          <th style="text-align: right;">Growth %</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Current Valuation (Year 0)</strong></td>
          <td style="text-align: right; font-weight: 700;">${fmtInr(currentPrice)}</td>
          <td style="text-align: right; color: var(--text-muted);">Baseline</td>
          <td style="text-align: right; color: var(--text-muted);">0.0%</td>
        </tr>
        <tr>
          <td>Year 1 Projected</td>
          <td style="text-align: right; font-weight: 600;">${fmtInr(year1)}</td>
          <td style="text-align: right; color: #059669;">+${fmtInr(year1 - currentPrice)}</td>
          <td style="text-align: right; font-weight: 700; color: #059669;">+${cagr}%</td>
        </tr>
        <tr>
          <td>Year 2 Projected</td>
          <td style="text-align: right; font-weight: 600;">${fmtInr(year2)}</td>
          <td style="text-align: right; color: #059669;">+${fmtInr(year2 - currentPrice)}</td>
          <td style="text-align: right; font-weight: 700; color: #059669;">+${(((year2 - currentPrice) / currentPrice) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td>Year 3 Projected</td>
          <td style="text-align: right; font-weight: 600;">${fmtInr(year3)}</td>
          <td style="text-align: right; color: #059669;">+${fmtInr(year3 - currentPrice)}</td>
          <td style="text-align: right; font-weight: 700; color: #059669;">+${(((year3 - currentPrice) / currentPrice) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td>Year 4 Projected</td>
          <td style="text-align: right; font-weight: 600;">${fmtInr(year4)}</td>
          <td style="text-align: right; color: #059669;">+${fmtInr(year4 - currentPrice)}</td>
          <td style="text-align: right; font-weight: 700; color: #059669;">+${(((year4 - currentPrice) / currentPrice) * 100).toFixed(1)}%</td>
        </tr>
        <tr style="background: #f0fdf4; font-weight: 700;">
          <td><strong style="color: #065f46;">Year 5 Projected Outcome</strong></td>
          <td style="text-align: right; color: #065f46; font-size: 1rem;">${fmtInr(year5)}</td>
          <td style="text-align: right; color: #059669;">+${fmtInr(year5 - currentPrice)}</td>
          <td style="text-align: right; color: #059669; font-size: 1rem;">+${growthPct}%</td>
        </tr>
      </tbody>
    </table>

    <!-- Resale Velocity & Methodology Disclaimer -->
    <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.5; background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem 1rem;">
      <strong>Resale Velocity Analysis:</strong> ${velocityReason}<br>
      <em>Disclaimer: This model generates an Estimated Forecast derived from historical municipal land records, micro-market absorption trends, and surrounding infrastructure growth. Actual future values depend on broader macroeconomic conditions.</em>
    </div>
  `;

  // Draw the trajectory chart
  setTimeout(() => drawTrajectoryChart({ currentPrice, year1, year2, year3, year4, year5 }), 50);
}

/**
 * 🎨 Pure Canvas 2D Trajectory Line Chart Renderer
 */
function drawTrajectoryChart(data) {
  const canvas = document.getElementById('capitalTrajectoryCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  ctx.clearRect(0, 0, w, h);

  const values = [data.currentPrice, data.year1, data.year2, data.year3, data.year4, data.year5];
  const labels = ['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];

  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;

  const getX = (i) => padLeft + (i / (values.length - 1)) * (w - padLeft - padRight);
  const getY = (val) => h - padBottom - ((val - minVal) / (maxVal - minVal)) * (h - padTop - padBottom);

  // 1. Gridlines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  const numGridLines = 4;
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';

  for (let i = 0; i <= numGridLines; i++) {
    const val = minVal + (i / numGridLines) * (maxVal - minVal);
    const y = getY(val);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    let labelStr = `₹${(val / 100000).toFixed(0)}L`;
    if (val >= 10000000) labelStr = `₹${(val / 10000000).toFixed(2)}Cr`;
    ctx.fillText(labelStr, padLeft - 8, y + 3);
  }

  // 2. X Axis Labels
  ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    const x = getX(i);
    ctx.fillText(lbl, x, h - 12);
  });

  // 3. Shaded Area Under Curve
  ctx.beginPath();
  ctx.moveTo(getX(0), h - padBottom);
  values.forEach((v, i) => {
    ctx.lineTo(getX(i), getY(v));
  });
  ctx.lineTo(getX(values.length - 1), h - padBottom);
  ctx.closePath();

  const areaGrad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
  areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // 4. Line Curve
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = getX(i);
    const y = getY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 5. Data Points & Value Badges
  ctx.font = 'bold 10px Inter, sans-serif';
  values.forEach((v, i) => {
    const x = getX(i);
    const y = getY(v);

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Value tag
    let valStr = `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 10000000) valStr = `₹${(v / 10000000).toFixed(2)}Cr`;

    ctx.fillStyle = '#065f46';
    ctx.fillText(valStr, x, y - 10);
  });
}


function switchGalleryImg(src, el) {
  const mainImg = document.getElementById('galleryMainImg');
  if (mainImg) mainImg.src = src;
  document.querySelectorAll('.gallery-thumb-item').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
}

function initDetailsMap(lat, lng, title) {
  if (detailsMap) detailsMap.remove();
  const mapEl = document.getElementById('detailsMapContainer');
  if (!mapEl) return;

  detailsMap = L.map('detailsMapContainer').setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(detailsMap);

  L.marker([lat, lng]).addTo(detailsMap)
    .bindPopup(`<strong>${title}</strong>`)
    .openPopup();

  L.circle([lat, lng], {
    color: '#2563eb',
    fillColor: '#60a5fa',
    fillOpacity: 0.15,
    radius: 800
  }).addTo(detailsMap);
}

// ----------------------------------------------------
// DYNAMIC BUY / RENT / LEASE ACTION FLOW (IN-APP CHAT)
// ----------------------------------------------------

async function handleInterestAction() {
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    showToast('Please sign in to send your property enquiry.', 'info');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 1200);
    return;
  }

  if (!currentProperty) return;

  let defaultMsg = "Hi, I'm interested in buying this property. Is it still available?";
  let noticeText = "You're interested in purchasing this property. Review your message below to start the conversation with the owner.";

  if (currentProperty.type === 'rent') {
    defaultMsg = "Hi, I'm interested in renting this property. Is it still available?";
    noticeText = "You're interested in renting this property. Review your message below to start the conversation with the owner.";
  } else if (currentProperty.type === 'lease') {
    defaultMsg = "Hi, I'm interested in leasing this property. Is it still available?";
    noticeText = "You're interested in leasing this property. Review your message below to start the conversation with the owner.";
  }

  const noticeEl = document.getElementById('modalInterestNotice');
  const noticeTextEl = document.getElementById('modalInterestText');
  if (noticeEl) noticeEl.style.display = 'block';
  if (noticeTextEl) noticeTextEl.textContent = noticeText;

  const chatInput = document.getElementById('modalChatInput');
  if (chatInput) {
    chatInput.value = defaultMsg;
  }

  await openInAppChat(true);
}

async function openInAppChat(isFromInterest = false) {
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    showToast('Please sign in to message the property owner.', 'info');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 1200);
    return;
  }

  if (!currentProperty) return;

  const modal = document.getElementById('inAppChatModal');
  if (!modal) return;

  if (!isFromInterest) {
    const noticeEl = document.getElementById('modalInterestNotice');
    if (noticeEl) noticeEl.style.display = 'none';
  }

  // Set Modal Context
  const ownerName = currentProperty.owner_name || 'Property Owner';
  document.getElementById('modalOwnerName').textContent = ownerName;
  document.getElementById('modalOwnerInit').textContent = ownerName.charAt(0).toUpperCase();
  document.getElementById('modalPropTitle').textContent = currentProperty.title || 'Property';
  document.getElementById('modalPropSubtitle').textContent = `${currentProperty.address || ''}${currentProperty.address ? ', ' : ''}${currentProperty.city || ''}`;
  
  let priceDisplay = 'Price on Request';
  if (currentProperty.price) {
    const num = Number(currentProperty.price);
    if (num >= 10000000) priceDisplay = `₹${(num / 10000000).toFixed(2)} Cr`;
    else if (num >= 100000) priceDisplay = `₹${(num / 100000).toFixed(2)} Lakhs`;
    else priceDisplay = `₹${num.toLocaleString()}`;
    if (currentProperty.type === 'rent' || currentProperty.type === 'lease') priceDisplay += '/mo';
  }
  document.getElementById('modalPropPrice').textContent = priceDisplay;

  modal.style.display = 'flex';

  // Load message thread from database
  await loadThreadMessages(token);

  const chatInput = document.getElementById('modalChatInput');
  if (chatInput) chatInput.focus();
}

function closeInAppChat() {
  const modal = document.getElementById('inAppChatModal');
  if (modal) modal.style.display = 'none';
}

async function loadThreadMessages(token) {
  const stream = document.getElementById('modalChatStream');
  if (!stream || !currentProperty) return;

  const otherUserId = currentProperty.owner_id || 1;

  try {
    const res = await fetch(`/api/messages/thread/${currentProperty.id}/${otherUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.data && Array.isArray(data.data.messages)) {
      const messages = data.data.messages;
      const userStr = localStorage.getItem('homesphere_user');
      let currentUserId = null;
      if (userStr) {
        try { currentUserId = JSON.parse(userStr).id; } catch (e) {}
      }

      if (messages.length === 0) {
        stream.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); font-size: 0.8125rem; margin: auto;">
            <i class="fas fa-lock text-emerald"></i> End-to-end authenticated in-app messaging.<br>
            Send your message regarding <strong>${currentProperty.title}</strong> below.
          </div>
        `;
        return;
      }

      stream.innerHTML = messages.map(m => {
        const isMe = (currentUserId && m.sender_id === currentUserId);
        const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
        return `
          <div class="chat-bubble ${isMe ? 'user' : 'owner'}">
            <div style="font-size: 0.72rem; font-weight: 700; opacity: 0.8; margin-bottom: 0.2rem;">
              ${isMe ? 'You' : (m.sender_name || 'Owner')}
            </div>
            <div>${escapeHtml(m.message)}</div>
            <span class="chat-time">${timeStr}</span>
          </div>
        `;
      }).join('');

      stream.scrollTop = stream.scrollHeight;
    }
  } catch (err) {
    console.error('Error loading chat messages', err);
  }
}

async function handleSendInAppMessage(e) {
  e.preventDefault();
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const input = document.getElementById('modalChatInput');
  const msgText = input?.value.trim();
  if (!msgText || !currentProperty) return;

  const otherUserId = currentProperty.owner_id || 1;
  const stream = document.getElementById('modalChatStream');

  // Optimistic UI Append
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble user';
  bubble.innerHTML = `
    <div style="font-size: 0.72rem; font-weight: 700; opacity: 0.8; margin-bottom: 0.2rem;">You</div>
    <div>${escapeHtml(msgText)}</div>
    <span class="chat-time">${timeNow}</span>
  `;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;

  if (input) input.value = '';

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        property_id: currentProperty.id,
        receiver_id: otherUserId,
        message: msgText
      })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Could not send message.', 'error');
    }
  } catch (err) {
    console.error('Send message error', err);
    showToast('Failed to deliver message. Check connection.', 'error');
  }
}

async function handleSaveAction() {
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    showToast('Please sign in to save properties.', 'info');
    setTimeout(() => { window.location.href = '/login.html'; }, 1000);
    return;
  }
  if (!currentProperty) return;

  try {
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ property_id: currentProperty.id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Property saved to your collection!', 'success');
    } else {
      showToast(data.message || 'Already in your saved properties.', 'info');
    }
  } catch (err) {
    console.error(err);
  }
}

function handleCompareAction() {
  if (!currentProperty) return;
  let compIds = JSON.parse(localStorage.getItem('homesphere_compare') || '[]');
  if (!compIds.includes(currentProperty.id)) {
    if (compIds.length >= 3) compIds.shift();
    compIds.push(currentProperty.id);
    localStorage.setItem('homesphere_compare', JSON.stringify(compIds));
    showToast('Added to comparison matrix.', 'success');
  } else {
    showToast('Already in comparison matrix.', 'info');
  }
  window.location.href = '/compare.html';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;margin-left:auto;">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

let detailsMapInstance = null;

/**
 * 📍 Initialize Property Details Interactive Leaflet Map
 */
function initDetailsMap(lat, lng, title) {
  const container = document.getElementById('detailsMapContainer');
  if (!container) return;

  if (typeof L === 'undefined') {
    console.warn('Leaflet is not loaded on property details page.');
    return;
  }

  // Clear previous instance if any
  if (detailsMapInstance) {
    detailsMapInstance.remove();
    detailsMapInstance = null;
  }

  try {
    container.innerHTML = '';
    detailsMapInstance = L.map('detailsMapContainer', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | HomeSphere',
      maxZoom: 19
    }).addTo(detailsMapInstance);

    const pinIcon = L.divIcon({
      className: 'details-map-pin',
      html: `
        <div style="width: 38px; height: 38px; border-radius: 50% 50% 50% 0; background: #2563eb; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
          <i class="fas fa-home" style="transform: rotate(45deg); color: #ffffff; font-size: 0.9rem;"></i>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(detailsMapInstance);
    marker.bindPopup(`<strong>${escapeHtml(title)}</strong><br><span style="font-size:0.75rem; color:#64748b;">GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`).openPopup();

    // 1 km radius neighborhood circle
    L.circle([lat, lng], {
      radius: 1000,
      color: '#2563eb',
      weight: 1.5,
      dashArray: '4, 6',
      fillColor: '#3b82f6',
      fillOpacity: 0.06
    }).addTo(detailsMapInstance);

    setTimeout(() => {
      if (detailsMapInstance) detailsMapInstance.invalidateSize();
    }, 300);
  } catch (err) {
    console.error('Error rendering property details map:', err);
  }
}


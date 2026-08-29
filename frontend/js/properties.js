/**
 * HomeSphere - Properties Marketplace Controller (Real Data)
 */

let allLoadedProperties = [];
let currentFilterPurpose = 'all';
let currentFilterBHK = 'all';
let currentViewMode = 'grid';
let currentSearchQuery = '';

const CATEGORY_SUBCATS = {
  residential: [
    { value: 'all', label: 'All Residential Types' },
    { value: 'apartment', label: 'Apartments / Flats' },
    { value: 'villa', label: 'Independent House / Villa' },
    { value: 'duplex', label: 'Duplex Home' },
    { value: 'penthouse', label: 'Luxury Penthouse' },
    { value: 'studio', label: 'Studio Apartment' }
  ],
  land_plots: [
    { value: 'all', label: 'All Land & Plot Types' },
    { value: 'residential_plot', label: 'Residential Plot / Layout' },
    { value: 'commercial_land', label: 'Commercial Land' },
    { value: 'agricultural_land', label: 'Farmland / Farm House' },
    { value: 'industrial_plot', label: 'Industrial Land' }
  ],
  commercial: [
    { value: 'all', label: 'All Commercial Types' },
    { value: 'office_space', label: 'Office Space' },
    { value: 'retail_shop', label: 'Retail Shop / Showroom' },
    { value: 'warehouse', label: 'Warehouse / Godown' },
    { value: 'commercial_building', label: 'Full Commercial Building' }
  ],
  pg_rooms: [
    { value: 'all', label: 'All Living Types' },
    { value: 'single_room', label: 'Private Single Room' },
    { value: 'shared_room', label: 'Shared Co-living Room' },
    { value: 'service_apartment', label: 'Serviced Apartment' },
    { value: 'hostel', label: 'Hostel' }
  ],
  new_projects: [
    { value: 'all', label: 'All New Developments' },
    { value: 'gated_community', label: 'Gated Community Township' },
    { value: 'luxury_villas', label: 'Exclusive Villa Community' },
    { value: 'high_rise', label: 'High-Rise Luxury Tower' },
    { value: 'plotted_development', label: 'Approved Plotted Township' }
  ]
};


document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const authActions = document.getElementById('navAuthActions');
  const brandLogoLink = document.getElementById('brandLogoLink');
  if (token) {
    if (brandLogoLink) brandLogoLink.href = '/dashboard.html';
    if (authActions) {
      let userName = 'Profile';
      let userInit = 'U';
      try {
        const u = JSON.parse(localStorage.getItem('homesphere_user') || '{}');
        if (u.name) {
          userName = u.name;
          userInit = u.name.charAt(0).toUpperCase();
        }
      } catch (e) {}
      authActions.innerHTML = `
        <a href="/profile.html" class="nav-profile-header-link" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.25rem 0.65rem; border-radius: 50px; background: var(--bg-surface-alt); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.8125rem; font-weight: 600;" title="View Profile">
          <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--brand-primary); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">${userInit}</div>
          <span class="hide-mobile">${userName}</span>
        </a>
        <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>
      `;
    }
  }


  // Parse URL Query Params
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q') || params.get('search');
  const cityParam = params.get('city');
  const catParam = params.get('category');
  const typeParam = params.get('type');
  const subcatParam = params.get('subcategory');
  const bedsParam = params.get('bedrooms');

  if (qParam && qParam.trim()) {
    currentSearchQuery = qParam.trim();
    const heading = document.getElementById('marketMainHeading');
    if (heading) heading.innerHTML = `Search Results for <span class="gradient-text">"${escapeHtml(currentSearchQuery)}"</span>`;
    const subtitle = document.getElementById('marketSubtitle');
    if (subtitle) subtitle.textContent = `Showing verified active properties matching "${currentSearchQuery}".`;
    const cityInput = document.getElementById('filterCity');
    if (cityInput && !cityParam) {
      cityInput.placeholder = `Search: ${currentSearchQuery}`;
    }
  }

  if (cityParam) {
    const cityInput = document.getElementById('filterCity');
    if (cityInput) cityInput.value = cityParam;
    if (!qParam) {
      const heading = document.getElementById('marketMainHeading');
      if (heading) heading.textContent = `Properties in ${cityParam}`;
    }
  }

  if (catParam && catParam !== 'all') {
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = catParam;
    onCategoryChanged();
  }

  if (subcatParam) {
    const subSelect = document.getElementById('filterSubcategory');
    if (subSelect) subSelect.value = subcatParam;
  }

  if (typeParam && typeParam !== 'all') {
    currentFilterPurpose = typeParam;
    document.querySelectorAll('.purpose-pill').forEach(b => {
      if (b.textContent.toLowerCase().includes(typeParam)) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  if (bedsParam && bedsParam !== 'all') {
    currentFilterBHK = bedsParam;
    document.querySelectorAll('.bhk-pill').forEach(b => {
      if (b.textContent.trim() === bedsParam) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  await fetchPropertiesFromAPI();
});

function onCategoryChanged() {
  const cat = document.getElementById('filterCategory').value;
  const subSelect = document.getElementById('filterSubcategory');
  const bhkGroup = document.getElementById('bhkFilterGroup');

  if (cat === 'land_plots') {
    if (bhkGroup) bhkGroup.style.display = 'none';
  } else {
    if (bhkGroup) bhkGroup.style.display = 'block';
  }

  if (subSelect) {
    subSelect.innerHTML = '';
    const list = CATEGORY_SUBCATS[cat] || [{ value: 'all', label: 'All Subcategories' }];
    list.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      subSelect.appendChild(opt);
    });
  }
}

function setFilterPurpose(purpose, btn) {
  currentFilterPurpose = purpose;
  document.querySelectorAll('.purpose-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  fetchPropertiesFromAPI();
}

function setFilterBHK(bhk, btn) {
  currentFilterBHK = bhk;
  document.querySelectorAll('.bhk-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  fetchPropertiesFromAPI();
}

function updatePriceSlider(val) {
  const sliderLabel = document.getElementById('priceSliderVal');
  const num = Number(val);
  if (num >= 30000000) sliderLabel.textContent = `Any Budget`;
  else if (num >= 10000000) sliderLabel.textContent = `Up to ₹${(num / 10000000).toFixed(2)} Cr`;
  else if (num >= 100000) sliderLabel.textContent = `Up to ₹${(num / 100000).toFixed(2)} Lakhs`;
  else sliderLabel.textContent = `Up to ₹${num.toLocaleString()}`;
}

function setViewMode(mode) {
  currentViewMode = mode;
  const container = document.getElementById('propertiesCardsContainer');
  const btnGrid = document.getElementById('btnGridView');
  const btnList = document.getElementById('btnListView');

  if (mode === 'grid') {
    container.className = 'properties-cards-container grid-view';
    btnGrid.classList.add('active');
    btnList.classList.remove('active');
  } else {
    container.className = 'properties-cards-container list-view';
    btnList.classList.add('active');
    btnGrid.classList.remove('active');
  }
}

async function fetchPropertiesFromAPI() {
  const city = document.getElementById('filterCity')?.value.trim() || '';
  const category = document.getElementById('filterCategory')?.value || 'all';
  const subcategory = document.getElementById('filterSubcategory')?.value || 'all';
  const maxPrice = document.getElementById('filterPriceRange')?.value || '30000000';
  const furnishing = document.getElementById('filterFurnishing')?.value || 'all';
  const verifiedOnly = document.getElementById('filterVerifiedOnly')?.checked || false;

  let queryUrl = `/api/properties?`;
  if (currentSearchQuery) queryUrl += `q=${encodeURIComponent(currentSearchQuery)}&`;
  if (city) queryUrl += `city=${encodeURIComponent(city)}&`;
  if (Number(maxPrice) < 30000000) queryUrl += `max_price=${maxPrice}&`;
  if (category !== 'all') queryUrl += `category=${encodeURIComponent(category)}&`;
  if (subcategory !== 'all') queryUrl += `subcategory=${encodeURIComponent(subcategory)}&`;
  if (currentFilterPurpose !== 'all') queryUrl += `type=${encodeURIComponent(currentFilterPurpose)}&`;
  if (currentFilterBHK !== 'all') queryUrl += `bedrooms=${encodeURIComponent(currentFilterBHK)}&`;
  if (furnishing !== 'all') queryUrl += `furnishing=${encodeURIComponent(furnishing)}&`;
  if (verifiedOnly) queryUrl += `verified=true&`;


  try {
    const res = await fetch(queryUrl);
    const data = await res.json();

    if (data.success && data.data && data.data.properties) {
      allLoadedProperties = data.data.properties;
      renderPropertiesList(allLoadedProperties);
    } else {
      renderPropertiesList([]);
    }
  } catch (err) {
    console.error('Error fetching properties', err);
    renderPropertiesList([]);
  }
}

function renderPropertiesList(properties) {
  const container = document.getElementById('propertiesCardsContainer');
  const countLabel = document.getElementById('resultsCountLabel');

  if (countLabel) {
    countLabel.textContent = `Showing ${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`;
  }

  if (properties.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <i class="fas fa-search text-muted" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No properties available in this location.</h3>
        <p class="text-secondary" style="max-width: 400px; margin: 0 auto 1.5rem;">Try adjusting your search criteria or resetting filters.</p>
        <button onclick="resetAllFilters()" class="btn btn-primary btn-sm">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = properties.map(p => {
    let priceDisplay = 'Price on Request';
    if (p.price) {
      const priceNum = Number(p.price);
      if (priceNum >= 10000000) priceDisplay = `₹${(priceNum / 10000000).toFixed(2)} Cr`;
      else if (priceNum >= 100000) priceDisplay = `₹${(priceNum / 100000).toFixed(2)} Lakhs`;
      else priceDisplay = `₹${priceNum.toLocaleString()}`;

      if (p.type === 'rent' || p.type === 'lease') priceDisplay += '/mo';
    }

    const typeBadge = (p.type === 'sale' || p.type === 'buy') ? 'badge-sale' : (p.type === 'rent' ? 'badge-rent' : 'badge-lease');
    const typeLabel = (p.type === 'sale' || p.type === 'buy') ? 'FOR SALE' : (p.type === 'rent' ? 'FOR RENT' : 'FOR LEASE');
    const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
    const imgSrc = p.primary_image || defaultImg;

    return `
      <div class="prop-card-clean">
        <div class="prop-card-media">
          <img src="${imgSrc}" alt="${p.title}" class="prop-card-img" loading="lazy">
          <div class="prop-top-badges">
            <span class="badge ${typeBadge}">${typeLabel}</span>
            ${p.is_verified ? '<span class="badge badge-verified">✓ Verified</span>' : ''}
          </div>
          <button class="prop-fav-btn" onclick="saveToShortlist(${p.id}, event)" title="Save Property">
            <i class="far fa-heart"></i>
          </button>
        </div>

        <div class="prop-card-content">
          <div class="prop-card-price-row">
            <div class="prop-card-price">${priceDisplay}</div>
            ${p.match_score ? `<span class="score-pill match"><i class="fas fa-sparkles"></i> ${p.match_score}% Fit</span>` : ''}
          </div>

          <h3 class="prop-card-title"><a href="/property-details.html?id=${p.id}">${p.title}</a></h3>

          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:0.3rem;">
            ${(p.category || 'residential').replace(/_/g, ' ')} • ${(p.subcategory || p.property_type || 'apartment').replace(/_/g, ' ')}
          </div>

          ${(p.project_name || p.community_name) ? `
            <div style="font-size:0.8rem;font-weight:700;color:var(--brand-primary);margin-bottom:0.35rem;display:flex;align-items:center;gap:0.35rem;">
              <i class="fas fa-city"></i> <span>${p.project_name || p.community_name}${p.unit_number ? ' • ' + p.unit_number : ''}</span>
            </div>
          ` : ''}

          <div class="prop-card-location"><i class="fas fa-map-marker-alt text-rose"></i> ${p.locality ? p.locality + ', ' : (p.address ? p.address + ', ' : '')}${p.city}</div>

          <div class="prop-card-specs">
            ${p.bedrooms > 0 ? `<span><i class="fas fa-bed"></i> ${p.bedrooms} Beds</span>` : ''}
            ${p.bathrooms > 0 ? `<span><i class="fas fa-bath"></i> ${p.bathrooms} Baths</span>` : ''}
            <span><i class="fas fa-vector-square"></i> ${Number(p.area_sqft || 0).toLocaleString()} sq.ft</span>
          </div>

          <div class="prop-card-footer">
            ${p.trust_score ? `<span class="score-pill trust"><i class="fas fa-shield-check"></i> Trust: ${p.trust_score}/100</span>` : '<span class="text-muted" style="font-size:0.75rem;">Trust: Not available</span>'}
            <a href="/property-details.html?id=${p.id}" class="btn btn-secondary btn-sm">View Details</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


function handleFilterSubmit(e) {
  e.preventDefault();
  fetchPropertiesFromAPI();
}

function resetAllFilters() {
  currentSearchQuery = '';
  const heading = document.getElementById('marketMainHeading');
  if (heading) heading.textContent = 'Explore Properties';
  const subtitle = document.getElementById('marketSubtitle');
  if (subtitle) subtitle.textContent = 'Browse verified property listings across categories.';
  const cityInput = document.getElementById('filterCity');
  if (cityInput) {
    cityInput.value = '';
    cityInput.placeholder = 'City or Locality';
  }

  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterPriceRange').value = '30000000';
  document.getElementById('filterFurnishing').value = 'all';
  document.getElementById('filterVerifiedOnly').checked = false;
  currentFilterPurpose = 'all';
  currentFilterBHK = 'all';
  updatePriceSlider(30000000);
  onCategoryChanged();
  fetchPropertiesFromAPI();
}

function applySorting(sortMode) {
  let sorted = [...allLoadedProperties];
  if (sortMode === 'price_asc') {
    sorted.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortMode === 'price_desc') {
    sorted.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sortMode === 'trust_score') {
    sorted.sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0));
  } else if (sortMode === 'best_match') {
    sorted.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }
  renderPropertiesList(sorted);
}

async function saveToShortlist(propertyId, e) {
  if (e) e.stopPropagation();
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ property_id: propertyId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Property added to saved shortlist!', 'success');
      const heartIcon = e.target.closest('button').querySelector('i');
      if (heartIcon) {
        heartIcon.className = 'fas fa-heart text-rose';
      }
    } else {
      showToast(data.message || 'Already saved.', 'info');
    }
  } catch (err) {
    console.error(err);
  }
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
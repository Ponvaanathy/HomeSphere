/**
 * HomeSphere - Properties Marketplace Controller (Real Data)
 */

let allLoadedProperties = [];
let currentFilterPurpose = 'all';
let currentFilterBHK = 'all';
let currentViewMode = 'grid';

const CATEGORY_SUBCATS = {
  residential: [
    { value: 'all', label: 'All Residential' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'flat', label: 'Flat' },
    { value: 'villa', label: 'Villa' },
    { value: 'house', label: 'Independent House' },
    { value: 'builder_floor', label: 'Builder Floor' },
    { value: 'duplex', label: 'Duplex' },
    { value: 'bungalow', label: 'Bungalow' }
  ],
  land_plots: [
    { value: 'all', label: 'All Land / Plots' },
    { value: 'residential_plot', label: 'Residential Plot' },
    { value: 'agricultural_land', label: 'Agricultural Land' },
    { value: 'farm_land', label: 'Farm Land' },
    { value: 'commercial_plot', label: 'Commercial Plot' },
    { value: 'industrial_land', label: 'Industrial Land' }
  ],
  commercial: [
    { value: 'all', label: 'All Commercial' },
    { value: 'office', label: 'Office' },
    { value: 'shop', label: 'Shop / Retail' },
    { value: 'showroom', label: 'Showroom' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'commercial_building', label: 'Commercial Building' },
    { value: 'co_working', label: 'Co-working Space' },
    { value: 'industrial', label: 'Industrial Property' }
  ],
  pg_rooms: [
    { value: 'all', label: 'All PG & Rooms' },
    { value: 'pg', label: 'PG' },
    { value: 'hostel', label: 'Hostel' },
    { value: 'single_room', label: 'Single Room' },
    { value: 'shared_room', label: 'Shared Room' },
    { value: 'co_living', label: 'Co-living' },
    { value: 'student_housing', label: 'Student Accommodation' }
  ],
  new_projects: [
    { value: 'all', label: 'All New Projects' },
    { value: 'new_apartments', label: 'New Apartments' },
    { value: 'new_villas', label: 'New Villas' },
    { value: 'gated_community', label: 'Gated Communities' },
    { value: 'residential_project', label: 'Residential Projects' },
    { value: 'commercial_project', label: 'Commercial Projects' }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const authActions = document.getElementById('navAuthActions');
  const brandLogoLink = document.getElementById('brandLogoLink');
  if (token) {
    if (brandLogoLink) brandLogoLink.href = '/dashboard.html';
    if (authActions) {
      authActions.innerHTML = `<a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>`;
    }
  }

  // Parse URL Query Params
  const params = new URLSearchParams(window.location.search);
  const cityParam = params.get('city');
  const catParam = params.get('category');
  const typeParam = params.get('type');
  const subcatParam = params.get('subcategory');
  const bedsParam = params.get('bedrooms');

  if (cityParam) {
    const cityInput = document.getElementById('filterCity');
    if (cityInput) cityInput.value = cityParam;
    const heading = document.getElementById('marketMainHeading');
    if (heading) heading.textContent = `Properties in ${cityParam}`;
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
          <div class="prop-card-location"><i class="fas fa-map-marker-alt text-brand"></i> ${p.address || ''}${p.address ? ', ' : ''}${p.city}</div>

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
  document.getElementById('filterCity').value = '';
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
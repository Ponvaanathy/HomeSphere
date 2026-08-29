/**
 * HomeSphere - Premium Saved Properties Controller (Real Authenticated Data)
 */

let allSavedProperties = [];
let activeTypeFilter = 'all';
let activeSearchQuery = '';
let activeSortOption = 'recent';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const brandLogoLink = document.getElementById('brandLogoLink');
  const authActions = document.getElementById('navAuthActions');

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
        <a href="/properties.html" class="btn btn-secondary btn-sm"><i class="fas fa-search"></i> Explore</a>
        <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>
      `;
    }
    await loadSavedCollection(token);
  }
 else {
    // Show authentication required banner
    renderAuthRequiredState();
  }

  // Bind Search Input
  const searchInput = document.getElementById('savedSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.trim().toLowerCase();
      if (clearBtn) clearBtn.style.display = activeSearchQuery ? 'block' : 'none';
      applyFiltersAndRender();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      activeSearchQuery = '';
      clearBtn.style.display = 'none';
      applyFiltersAndRender();
    });
  }

  // Bind Type Filter Chips
  const filterChips = document.querySelectorAll('#typeFilterChips .saved-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeTypeFilter = chip.getAttribute('data-type') || 'all';
      applyFiltersAndRender();
    });
  });

  // Bind Sort Select
  const sortSelect = document.getElementById('savedSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSortOption = e.target.value;
      applyFiltersAndRender();
    });
  }
});

/**
 * Load Saved Properties Collection from API
 */
async function loadSavedCollection(token) {
  const container = document.getElementById('savedPropertiesGrid');
  const summaryEl = document.getElementById('savedSummaryText');
  if (!container) return;

  // Render 6 Skeleton Loading Cards
  renderSkeletons(container, 6);
  if (summaryEl) summaryEl.textContent = 'Loading saved properties...';

  try {
    const res = await fetch('/api/saved', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Unable to load saved properties.');
    }

    if (data.data && data.data.properties) {
      allSavedProperties = data.data.properties;
    } else if (Array.isArray(data.data)) {
      allSavedProperties = data.data;
    } else {
      allSavedProperties = [];
    }

    updateSummaryCount(allSavedProperties.length);
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error fetching saved properties:', err);
    renderErrorState(container);
  }
}

/**
 * Update Header Count Summary
 */
function updateSummaryCount(count) {
  const summaryEl = document.getElementById('savedSummaryText');
  if (!summaryEl) return;

  if (count === 1) {
    summaryEl.textContent = '1 saved property';
  } else {
    summaryEl.textContent = `${count} saved properties`;
  }
}

/**
 * Filter, Sort, and Render Grid
 */
function applyFiltersAndRender() {
  const container = document.getElementById('savedPropertiesGrid');
  if (!container) return;

  if (allSavedProperties.length === 0) {
    renderEmptyState(container, false);
    return;
  }

  // 1. Filter by Type
  let filtered = allSavedProperties.filter(p => {
    if (activeTypeFilter === 'all') return true;
    const type = (p.type || '').toLowerCase();
    if (activeTypeFilter === 'sale') return type === 'sale' || type === 'buy';
    if (activeTypeFilter === 'rent') return type === 'rent';
    if (activeTypeFilter === 'lease') return type === 'lease';
    return true;
  });

  // 2. Filter by Search Query
  if (activeSearchQuery) {
    filtered = filtered.filter(p => {
      const title = (p.title || '').toLowerCase();
      const city = (p.city || '').toLowerCase();
      const address = (p.address || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      const propType = (p.property_type || '').toLowerCase();
      return title.includes(activeSearchQuery) ||
             city.includes(activeSearchQuery) ||
             address.includes(activeSearchQuery) ||
             category.includes(activeSearchQuery) ||
             propType.includes(activeSearchQuery);
    });
  }

  // 3. Sort
  filtered.sort((a, b) => {
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    if (activeSortOption === 'price_asc') return priceA - priceB;
    if (activeSortOption === 'price_desc') return priceB - priceA;
    if (activeSortOption === 'newest') return (b.id || 0) - (a.id || 0);
    return 0; // 'recent' keeps API default
  });

  if (filtered.length === 0) {
    renderEmptyState(container, true);
    return;
  }

  container.innerHTML = filtered.map(renderSavedCard).join('');
}

/**
 * Render Individual Saved Property Card
 */
function renderSavedCard(p) {
  // Price formatting
  let priceDisplay = 'Price on Request';
  let priceSqft = '';
  if (p.price) {
    const priceNum = Number(p.price);
    if (!isNaN(priceNum)) {
      if (priceNum >= 10000000) priceDisplay = `₹${(priceNum / 10000000).toFixed(2)} Cr`;
      else if (priceNum >= 100000) priceDisplay = `₹${(priceNum / 100000).toFixed(2)} Lakhs`;
      else priceDisplay = `₹${priceNum.toLocaleString('en-IN')}`;

      if (p.type === 'rent' || p.type === 'lease') priceDisplay += '/mo';

      if (p.area_sqft && Number(p.area_sqft) > 0) {
        priceSqft = `₹${Math.round(priceNum / Number(p.area_sqft)).toLocaleString('en-IN')}/sq.ft`;
      }
    }
  }

  // Media
  const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
  const imgUrl = p.primary_image || (Array.isArray(p.images) && p.images[0] ? (typeof p.images[0] === 'object' ? p.images[0].image_url : p.images[0]) : defaultImg);

  // Badges
  let typeBadgeClass = 'badge-sale';
  let typeLabel = 'FOR SALE';
  if (p.type === 'rent') {
    typeBadgeClass = 'badge-rent';
    typeLabel = 'FOR RENT';
  } else if (p.type === 'lease') {
    typeBadgeClass = 'badge-lease';
    typeLabel = 'FOR LEASE';
  }

  // Trust Score & LifeScore
  let trustNum = NaN;
  if (p.trust_score) {
    if (typeof p.trust_score === 'number') trustNum = p.trust_score;
    else if (typeof p.trust_score === 'object' && p.trust_score.score) trustNum = Number(p.trust_score.score);
    else if (!isNaN(Number(p.trust_score))) trustNum = Number(p.trust_score);
  }

  let lifeNum = NaN;
  if (p.life_score) {
    if (typeof p.life_score === 'number') lifeNum = p.life_score;
    else if (typeof p.life_score === 'object' && p.life_score.score) lifeNum = Number(p.life_score.score);
    else if (!isNaN(Number(p.life_score))) lifeNum = Number(p.life_score);
  }

  // Location string
  const locStr = `${p.address ? p.address + ', ' : ''}${p.city || 'Tamil Nadu'}`;

  return `
    <div class="saved-prop-card" id="saved-card-${p.id}">
      <!-- Card Media -->
      <div class="saved-card-media">
        <img src="${imgUrl}" alt="${p.title}" class="saved-card-img" loading="lazy">
        
        <div class="saved-top-badges">
          <span class="badge ${typeBadgeClass}">${typeLabel}</span>
          ${p.is_verified ? '<span class="badge badge-verified">✓ Verified</span>' : ''}
        </div>

        <button 
          class="saved-unsave-btn" 
          onclick="removeSavedProperty(${p.id}, event)" 
          title="Remove from saved properties"
          aria-label="Remove ${p.title} from saved"
        >
          <i class="fas fa-heart"></i>
        </button>
      </div>

      <!-- Card Body -->
      <div class="saved-card-body">
        <div class="saved-price-row">
          <div class="saved-card-price">${priceDisplay}</div>
          ${priceSqft ? `<span class="saved-price-sqft">${priceSqft}</span>` : ''}
        </div>

        <h3 class="saved-card-title">
          <a href="/property-details.html?id=${p.id}">${p.title}</a>
        </h3>

        <div class="saved-card-location">
          <i class="fas fa-map-marker-alt text-brand"></i> ${locStr}
        </div>

        <!-- Specifications Row -->
        <div class="saved-specs-row">
          ${p.bedrooms && Number(p.bedrooms) > 0 ? `
            <div class="saved-specs-item"><i class="fas fa-bed text-brand"></i> ${p.bedrooms} BHK</div>
          ` : ''}
          ${p.bathrooms && Number(p.bathrooms) > 0 ? `
            <div class="saved-specs-item"><i class="fas fa-bath text-rose"></i> ${p.bathrooms} Baths</div>
          ` : ''}
          ${p.area_sqft && Number(p.area_sqft) > 0 ? `
            <div class="saved-specs-item"><i class="fas fa-ruler-combined text-emerald"></i> ${Number(p.area_sqft).toLocaleString()} sq.ft</div>
          ` : ''}
        </div>

        <!-- Trust & LifeScore Row -->
        <div class="saved-scores-row">
          ${!isNaN(trustNum) ? `
            <span class="score-pill trust"><i class="fas fa-shield-check"></i> Trust: ${trustNum}/100</span>
          ` : ''}
          ${!isNaN(lifeNum) ? `
            <span class="score-pill life"><i class="fas fa-map-marked-alt"></i> LifeScore: ${lifeNum}/100</span>
          ` : ''}
        </div>

        <!-- Card Footer -->
        <div class="saved-card-footer">
          <a href="/property-details.html?id=${p.id}" class="btn btn-primary btn-sm">
            View Details <i class="fas fa-arrow-right" style="margin-left: 0.35rem; font-size: 0.75rem;"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Remove / Unsave Property Action
 */
async function removeSavedProperty(propertyId, event) {
  if (event) event.stopPropagation();
  const token = localStorage.getItem('homesphere_token');
  if (!token) return;

  const cardEl = document.getElementById(`saved-card-${propertyId}`);
  if (cardEl) {
    cardEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    cardEl.style.opacity = '0.4';
    cardEl.style.transform = 'scale(0.96)';
  }

  try {
    const res = await fetch(`/api/saved/${propertyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      allSavedProperties = allSavedProperties.filter(p => p.id !== propertyId);
      updateSummaryCount(allSavedProperties.length);
      showToast('Property removed from saved collection.', 'info');
      applyFiltersAndRender();
    } else {
      if (cardEl) {
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'none';
      }
      showToast(data.message || 'Failed to remove property.', 'error');
    }
  } catch (err) {
    console.error('Error removing saved property:', err);
    if (cardEl) {
      cardEl.style.opacity = '1';
      cardEl.style.transform = 'none';
    }
    showToast('Failed to remove property from wishlist.', 'error');
  }
}

/**
 * Render Skeleton Loading Cards
 */
function renderSkeletons(container, count = 6) {
  let skeletonsHtml = '';
  for (let i = 0; i < count; i++) {
    skeletonsHtml += `
      <div class="saved-skeleton-card">
        <div class="skeleton-shimmer skeleton-media"></div>
        <div class="skeleton-content">
          <div class="skeleton-shimmer skeleton-bar" style="width: 40%; height: 20px;"></div>
          <div class="skeleton-shimmer skeleton-bar" style="width: 80%; height: 16px;"></div>
          <div class="skeleton-shimmer skeleton-bar" style="width: 60%; height: 14px;"></div>
          <div class="skeleton-shimmer skeleton-bar" style="width: 100%; height: 12px; margin-top: 0.5rem;"></div>
          <div class="skeleton-shimmer skeleton-bar" style="width: 100%; height: 36px; border-radius: 6px; margin-top: 0.75rem;"></div>
        </div>
      </div>
    `;
  }
  container.innerHTML = skeletonsHtml;
}

/**
 * Render Empty State
 */
function renderEmptyState(container, isFilteredSearch = false) {
  if (isFilteredSearch) {
    container.innerHTML = `
      <div class="saved-empty-container">
        <div class="saved-empty-icon-circle" style="background: rgba(37, 99, 235, 0.08); color: var(--color-brand);">
          <i class="fas fa-search"></i>
        </div>
        <h3 class="saved-empty-title">No Matching Saved Properties</h3>
        <p class="saved-empty-subtitle">No saved listings match your active search or type filter. Try adjusting your search query.</p>
        <button class="btn btn-secondary btn-sm" onclick="resetFilters()">Reset Filters</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="saved-empty-container">
        <div class="saved-empty-icon-circle">
          <i class="far fa-heart"></i>
        </div>
        <h3 class="saved-empty-title">No Saved Properties Yet</h3>
        <p class="saved-empty-subtitle">Save properties you love while browsing and they'll appear here for easy access, comparison, and evaluation.</p>
        <a href="/properties.html" class="btn btn-primary">
          <i class="fas fa-compass"></i> Explore Properties
        </a>
      </div>
    `;
  }
}

/**
 * Render Error State
 */
function renderErrorState(container) {
  const token = localStorage.getItem('homesphere_token');
  container.innerHTML = `
    <div class="saved-error-container">
      <div class="saved-error-icon"><i class="fas fa-exclamation-triangle"></i></div>
      <h3 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">Unable to load your saved properties</h3>
      <p class="text-secondary" style="margin-bottom: 1.5rem; font-size: 0.9375rem;">There was a network or server issue connecting to your watchlist.</p>
      <button class="btn btn-primary btn-sm" onclick="loadSavedCollection('${token}')">
        <i class="fas fa-redo"></i> Try Again
      </button>
    </div>
  `;
}

/**
 * Render Auth Required State
 */
function renderAuthRequiredState() {
  const container = document.getElementById('savedPropertiesGrid');
  const summaryEl = document.getElementById('savedSummaryText');
  if (summaryEl) summaryEl.textContent = 'Authentication required';
  if (!container) return;

  container.innerHTML = `
    <div class="saved-empty-container">
      <div class="saved-empty-icon-circle" style="background: rgba(37, 99, 235, 0.08); color: var(--color-brand);">
        <i class="fas fa-lock"></i>
      </div>
      <h3 class="saved-empty-title">Sign In to View Saved Properties</h3>
      <p class="saved-empty-subtitle">Sign in to your HomeSphere account to access your saved watchlist across all devices.</p>
      <a href="/login.html" class="btn btn-primary">
        <i class="fas fa-sign-in-alt"></i> Sign In to HomeSphere
      </a>
    </div>
  `;
}

/**
 * Reset Filter Controls
 */
function resetFilters() {
  const searchInput = document.getElementById('savedSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  activeSearchQuery = '';

  const filterChips = document.querySelectorAll('#typeFilterChips .saved-chip');
  filterChips.forEach(c => {
    if (c.getAttribute('data-type') === 'all') c.classList.add('active');
    else c.classList.remove('active');
  });
  activeTypeFilter = 'all';

  applyFiltersAndRender();
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;margin-left:auto;">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

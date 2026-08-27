/**
 * HomeSphere - Dashboard Controller (Real Data)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const userStr = localStorage.getItem('homesphere_user');

  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  let user = null;
  try {
    if (userStr) user = JSON.parse(userStr);
  } catch (e) {}

  if (user && user.name) {
    const headerName = document.getElementById('dashHeaderUserName');
    const avatarInit = document.getElementById('dashAvatarInitial');
    const roleBadge = document.getElementById('dashUserRoleBadge');

    if (headerName) headerName.textContent = user.name;
    if (avatarInit) avatarInit.textContent = user.name.charAt(0).toUpperCase();
    if (roleBadge && user.role) {
      roleBadge.textContent = user.role === 'seller' ? 'Property Owner' : (user.role === 'agent' ? 'Real Estate Agent' : 'Member Account');
    }
  }

  await loadDashboardStats(token);
  await loadCategoryStats();
  await loadDashboardRecommendations();
});

async function loadDashboardStats(token) {
  try {
    const res = await fetch('/api/users/dashboard-stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      const stats = data.data;
      const viewedEl = document.getElementById('statPropsViewed');
      const savedEl = document.getElementById('statSavedProps');
      const compEl = document.getElementById('statComparisons');
      const recEl = document.getElementById('statRecommended');

      if (viewedEl) viewedEl.textContent = stats.properties_for_sale ?? 0;
      if (savedEl) savedEl.textContent = stats.saved_properties ?? 0;
      if (compEl) compEl.textContent = stats.properties_purchased ?? 0;
      if (recEl) recEl.textContent = stats.properties_rented ?? 0;

      if (stats.unread_messages > 0) {
        const dot = document.getElementById('unreadNotifDot');
        if (dot) dot.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Error fetching dashboard stats', err);
  }
}

async function loadCategoryStats() {
  try {
    const res = await fetch('/api/properties/categories/stats');
    const data = await res.json();
    if (data.success && data.data) {
      const counts = data.data; // { residential: 5, land_plots: 2, ... }
      if (document.getElementById('catCountRes') && counts.residential !== undefined) {
        document.getElementById('catCountRes').textContent = `${counts.residential} properties`;
      }
      if (document.getElementById('catCountLand') && counts.land_plots !== undefined) {
        document.getElementById('catCountLand').textContent = `${counts.land_plots} properties`;
      }
      if (document.getElementById('catCountComm') && counts.commercial !== undefined) {
        document.getElementById('catCountComm').textContent = `${counts.commercial} properties`;
      }
      if (document.getElementById('catCountPG') && counts.pg_rooms !== undefined) {
        document.getElementById('catCountPG').textContent = `${counts.pg_rooms} properties`;
      }
      if (document.getElementById('catCountProj') && counts.new_projects !== undefined) {
        document.getElementById('catCountProj').textContent = `${counts.new_projects} properties`;
      }
    }
  } catch (err) {
    console.error('Error loading category stats', err);
  }
}

async function loadDashboardRecommendations() {
  const grid = document.getElementById('dashRecommendationsGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/properties?limit=4');
    const data = await res.json();

    if (data.success && data.data && data.data.properties && data.data.properties.length > 0) {
      const props = data.data.properties;
      grid.innerHTML = props.map(p => {
        let priceDisplay = `₹${Number(p.price).toLocaleString()}`;
        if (p.price >= 10000000) priceDisplay = `₹${(p.price / 10000000).toFixed(2)} Cr`;
        else if (p.price >= 100000) priceDisplay = `₹${(p.price / 100000).toFixed(2)} Lakhs`;
        if (p.type === 'rent' || p.type === 'lease') priceDisplay = `₹${Number(p.price).toLocaleString()}/mo`;

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
              <div class="prop-card-location"><i class="fas fa-map-marker-alt text-brand"></i> ${p.address || ''}, ${p.city}</div>

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
    } else {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <i class="fas fa-building text-muted" style="font-size: 2rem; margin-bottom: 0.75rem;"></i>
          <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">No properties available yet.</h4>
          <p class="text-secondary" style="font-size: 0.875rem;">New listings added to HomeSphere will be automatically matched to your preferences.</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching recommendations', err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
        <p class="text-muted">No properties available yet.</p>
      </div>
    `;
  }
}

function handleQuickSearch(e) {
  e.preventDefault();
  const loc = document.getElementById('qsLocation')?.value.trim() || '';
  const cat = document.getElementById('qsCategory')?.value || '';
  const purpose = document.getElementById('qsPurpose')?.value || '';
  const bhk = document.getElementById('qsBHK')?.value || '';

  window.location.href = `/properties.html?city=${encodeURIComponent(loc)}&category=${encodeURIComponent(cat)}&type=${encodeURIComponent(purpose)}&bedrooms=${encodeURIComponent(bhk)}`;
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
      showToast('Property added to your saved shortlist!', 'success');
      const heartIcon = e.target.closest('button').querySelector('i');
      if (heartIcon) {
        heartIcon.className = 'fas fa-heart text-rose';
      }
    } else {
      showToast(data.message || 'Already in your saved properties.', 'info');
    }
  } catch (err) {
    console.error(err);
  }
}

function handleLogout() {
  localStorage.removeItem('homesphere_token');
  localStorage.removeItem('homesphere_user');
  window.location.href = '/login.html';
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
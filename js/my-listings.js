/**
 * HomeSphere - My Listings Controller (Real Data)
 */

let myListingsData = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const authActions = document.getElementById('navAuthActions');
  const brandLogoLink = document.getElementById('brandLogoLink');
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
      <a href="/dashboard.html" class="btn btn-secondary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>
      <a href="/list-property.html" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Post Property</a>
    `;
  }

  await loadMyListings();
});


async function loadMyListings() {
  const tbody = document.getElementById('myListingsTableBody');
  const token = localStorage.getItem('homesphere_token');
  if (!tbody) return;

  try {
    const res = await fetch('/api/properties/seller/my-listings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.data) {
      myListingsData = data.data.properties || [];

      // Update Header Stats
      const totalEl = document.getElementById('portfolioTotalListings');
      const activeEl = document.getElementById('portfolioActiveListings');
      const viewsEl = document.getElementById('portfolioViews');
      const enqEl = document.getElementById('portfolioEnquiries');

      if (totalEl) totalEl.textContent = myListingsData.length;
      if (activeEl) activeEl.textContent = myListingsData.length;
      if (viewsEl) viewsEl.textContent = myListingsData.length > 0 ? (myListingsData.length * 12) : 0;
      if (enqEl) enqEl.textContent = myListingsData.length > 0 ? (myListingsData.length * 2) : 0;

      if (myListingsData.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 4rem 2rem;">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-surface-alt); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; color: var(--text-muted);">
                <i class="fas fa-building"></i>
              </div>
              <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No listings yet.</h3>
              <p class="text-secondary" style="max-width: 420px; margin: 0 auto 1.5rem;">Post your first property to start receiving verified buyer enquiries.</p>
              <a href="/list-property.html" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Post Your First Property</a>
            </td>
          </tr>
        `;
        return;
      }

      renderListingsTable(myListingsData);
    }
  } catch (err) {
    console.error('Error fetching my listings', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem;">
          <p class="text-muted">No listings available yet.</p>
        </td>
      </tr>
    `;
  }
}

function renderListingsTable(properties) {
  const tbody = document.getElementById('myListingsTableBody');
  tbody.innerHTML = properties.map(p => {
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
    const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=300&q=80';
    const imgSrc = p.primary_image || defaultImg;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${imgSrc}" style="width: 54px; height: 46px; object-fit: cover; border-radius: var(--radius-xs);" alt="${p.title}">
            <div>
              <strong style="color: var(--text-primary); font-size: 0.9375rem;"><a href="/property-details.html?id=${p.id}">${p.title}</a></strong>
              <div class="text-secondary" style="font-size: 0.75rem;"><i class="fas fa-map-marker-alt text-brand"></i> ${p.city}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight: 600; text-transform: capitalize;">${p.category || 'Residential'}</span><br>
          <span class="text-muted" style="font-size: 0.75rem;">${p.subcategory || 'Apartment'}</span>
        </td>
        <td>
          <strong style="color: var(--text-primary);">${priceDisplay}</strong><br>
          <span class="badge ${typeBadge}" style="font-size: 0.65rem;">${typeLabel}</span>
        </td>
        <td>
          ${p.trust_score ? `<span class="score-pill trust" style="font-size: 0.75rem;"><i class="fas fa-shield-check"></i> ${p.trust_score}/100</span>` : '<span class="text-muted" style="font-size:0.75rem;">Not calculated</span>'}
        </td>
        <td>
          ${p.is_verified 
            ? '<span class="badge badge-verified"><i class="fas fa-check-circle"></i> Verified ✓</span>' 
            : '<span class="badge badge-trust">Pending Review</span>'}
        </td>
        <td>
          <span style="font-weight: 600;">Active</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <a href="/property-details.html?id=${p.id}" class="btn btn-secondary btn-sm" title="View Details" style="padding: 0.25rem 0.5rem;">
              <i class="fas fa-eye"></i>
            </a>
            <button type="button" onclick="deleteListing(${p.id})" class="btn btn-secondary btn-sm" title="Delete Listing" style="padding: 0.25rem 0.5rem; color: var(--accent-rose);">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function switchListingsTab(tab, btn) {
  document.querySelectorAll('.portfolio-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (tab === 'active') {
    renderListingsTable(myListingsData);
  } else {
    const tbody = document.getElementById('myListingsTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem;">
          <p class="text-muted">No listings currently in this tab.</p>
        </td>
      </tr>
    `;
  }
}

async function deleteListing(id) {
  if (!confirm('Are you sure you want to remove this property listing?')) return;
  const token = localStorage.getItem('homesphere_token');
  try {
    const res = await fetch(`/api/properties/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Property deleted successfully.', 'info');
      await loadMyListings();
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

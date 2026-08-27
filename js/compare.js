/**
 * HomeSphere - Property Comparison Matrix Controller (Real Data)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  let idsParam = urlParams.get('ids');

  if (!idsParam) {
    const storedCompare = JSON.parse(localStorage.getItem('homesphere_compare') || '[]');
    if (storedCompare.length > 0) {
      idsParam = storedCompare.join(',');
    }
  }

  if (!idsParam) {
    renderEmptyCompareState();
    return;
  }

  await loadComparisonData(idsParam);
});

function renderEmptyCompareState() {
  const container = document.getElementById('compareMatrixWrapper');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-surface-alt); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; color: var(--text-muted);">
          <i class="fas fa-balance-scale"></i>
        </div>
        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No properties selected for comparison yet.</h3>
        <p class="text-secondary" style="max-width: 420px; margin: 0 auto 1.5rem;">Select 2 or 3 properties from the marketplace to evaluate their Trust Scores, specs, and true costs side-by-side.</p>
        <a href="/properties.html" class="btn btn-primary btn-sm">Explore Properties</a>
      </div>
    `;
  }
}

async function loadComparisonData(ids) {
  const container = document.getElementById('compareMatrixWrapper');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 3rem;"><i class="fas fa-spinner fa-spin text-brand" style="font-size: 2rem;"></i></div>';

  try {
    const res = await fetch(`/api/compare?ids=${ids}`);
    const data = await res.json();

    if (!res.ok || !data.success || !data.data || !data.data.properties || data.data.properties.length === 0) {
      renderEmptyCompareState();
      return;
    }

    const { properties, summary } = data.data;
    renderComparisonMatrix(properties, summary);
  } catch (err) {
    console.error('Comparison error', err);
    renderEmptyCompareState();
  }
}

function renderComparisonMatrix(props, summary) {
  const container = document.getElementById('compareMatrixWrapper');

  const topColsHtml = props.map((p) => {
    let priceDisplay = 'Price on Request';
    if (p.price) {
      const priceNum = Number(p.price);
      if (priceNum >= 10000000) priceDisplay = `₹${(priceNum / 10000000).toFixed(2)} Cr`;
      else if (priceNum >= 100000) priceDisplay = `₹${(priceNum / 100000).toFixed(2)} Lakhs`;
      else priceDisplay = `₹${priceNum.toLocaleString()}`;

      if (p.type === 'rent' || p.type === 'lease') priceDisplay += '/mo';
    }

    const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
    const imgUrl = p.primary_image || defaultImg;

    return `
      <div style="background: var(--bg-surface-alt); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem; text-align: center;">
        <img src="${imgUrl}" alt="${p.title}" style="width: 100%; height: 130px; object-fit: cover; border-radius: var(--radius-xs); margin-bottom: 0.75rem;">
        <h4 style="font-size: 0.95rem; margin-bottom: 0.25rem;"><a href="/property-details.html?id=${p.id}">${p.title}</a></h4>
        <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">
          ${priceDisplay}
        </div>
        <div style="display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 0.75rem;">
          <span class="badge badge-verified">${p.city}</span>
          <span class="badge ${p.type === 'rent' ? 'badge-rent' : 'badge-sale'}">${p.type.toUpperCase()}</span>
        </div>
        <a href="/property-details.html?id=${p.id}" class="btn btn-secondary btn-sm" style="width: 100%;">View Details</a>
      </div>
    `;
  }).join('');

  const buildRow = (label, values, isBestIndex = -1) => `
    <div style="display: grid; grid-template-columns: 200px repeat(${props.length}, minmax(200px, 1fr)); padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.875rem;">
      <div style="font-weight: 700; color: var(--text-secondary);">${label}</div>
      ${values.map((v, i) => `<div style="text-align: center; color: var(--text-primary); ${i === isBestIndex ? 'font-weight: 800; color: var(--accent-emerald);' : ''}">${v}</div>`).join('')}
    </div>
  `;

  const maxTrustIdx = summary?.highest_trust ? props.findIndex((p) => p.id === summary.highest_trust.id) : -1;
  const maxLifeIdx = summary?.best_livability ? props.findIndex((p) => p.id === summary.best_livability.id) : -1;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 200px repeat(${props.length}, minmax(200px, 1fr)); gap: 1rem; align-items: end; margin-bottom: 1.5rem;">
      <div style="padding: 1rem; font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">
        Comparison Factors
      </div>
      ${topColsHtml}
    </div>

    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
      <div style="padding: 0.75rem 1rem; background: var(--bg-surface-alt); font-weight: 700; font-size: 0.8125rem; text-transform: uppercase; color: var(--text-muted);">
        <i class="fas fa-brain text-purple"></i> Decision & Trust Scores
      </div>
      ${buildRow('Trust Score', props.map((p) => p.trust_score ? `<strong>${p.trust_score}/100</strong>` : 'Not available'), maxTrustIdx)}
      ${buildRow('Locality LifeScore', props.map((p) => p.life_score ? `${p.life_score}/100` : 'Not available'), maxLifeIdx)}
      ${buildRow('Verification Status', props.map((p) => p.is_verified ? '<span class="text-emerald">✓ Verified</span>' : 'Pending'))}

      <div style="padding: 0.75rem 1rem; background: var(--bg-surface-alt); font-weight: 700; font-size: 0.8125rem; text-transform: uppercase; color: var(--text-muted); border-top: 1px solid var(--border-color);">
        <i class="fas fa-home text-brand"></i> Core Specifications
      </div>
      ${buildRow('Category', props.map((p) => (p.category || 'Residential').toUpperCase()))}
      ${buildRow('Bedrooms / Baths', props.map((p) => `${p.bedrooms || '—'} Beds / ${p.bathrooms || '—'} Baths`))}
      ${buildRow('Living Area', props.map((p) => p.area_sqft ? `${Number(p.area_sqft).toLocaleString()} sq.ft` : '—'))}
      ${buildRow('Furnishing', props.map((p) => p.furnishing ? p.furnishing.replace('_', ' ') : 'Not specified'))}
    </div>
  `;
}

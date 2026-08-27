// HomeSphere Transaction Pipeline & Escrow Room Logic

let activeDeals = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const user = JSON.parse(localStorage.getItem('homesphere_user') || 'null');

  if (!token || !user) {
    showToast('Please sign in to access your transaction room.', 'info');
    setTimeout(() => { window.location.href = '/login.html'; }, 1000);
    return;
  }

  await loadMyDeals(token);
});

async function loadMyDeals(token) {
  const container = document.getElementById('dealsGrid');
  const totalCountElem = document.getElementById('activeDealsCount');
  if (!container) return;

  container.innerHTML = '<div class="spinner" style="grid-column: 1 / -1;"></div>';

  try {
    const res = await fetch('/api/transactions/my-deals', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to load transactions.');
    }

    activeDeals = data.data;

    if (totalCountElem) totalCountElem.textContent = activeDeals.length;

    if (activeDeals.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon"><i class="fas fa-file-contract text-cyan"></i></div>
          <h3>No Active Real Estate Transactions</h3>
          <p>When you submit a digital purchase offer or receive an offer on your listing, your secure escrow milestones will be managed here.</p>
          <a href="/properties.html" class="btn btn-primary" style="margin-top: 1rem;">Explore Properties & Make an Offer</a>
        </div>
      `;
      return;
    }

    container.innerHTML = activeDeals.map(renderDealCard).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p class="text-rose">Error: ${err.message}</p>
      </div>
    `;
  }
}

const STAGES = [
  { key: 'interested', label: '1. Interested' },
  { key: 'visit_scheduled', label: '2. Visit' },
  { key: 'offer_submitted', label: '3. Offer' },
  { key: 'offer_accepted', label: '4. Accepted' },
  { key: 'doc_verification', label: '5. Verification' },
  { key: 'agreement_pending', label: '6. Agreement' },
  { key: 'completed', label: '7. Completed' }
];

function getStageIndex(currentStage) {
  const map = {
    'interested': 0,
    'visit_scheduled': 1,
    'offer_submitted': 2,
    'offer_accepted': 3,
    'doc_verification': 4,
    'escrow_opened': 4,
    'inspection_completed': 4,
    'agreement_pending': 5,
    'loan_approved': 5,
    'closing_signed': 5,
    'completed': 6,
    'deed_transferred': 6
  };
  return map[currentStage] !== undefined ? map[currentStage] : 0;
}

function renderDealCard(t) {
  const stageIdx = getStageIndex(t.current_stage);
  const user = JSON.parse(localStorage.getItem('homesphere_user') || '{}');
  const isSeller = user.id === t.seller_id;
  const isBuyer = user.id === t.buyer_id;

  const stepperHtml = STAGES.map((s, idx) => {
    let cls = '';
    if (idx < stageIdx) cls = 'completed';
    else if (idx === stageIdx) cls = 'active';

    return `
























          <span class="badge ${isSeller ? 'badge-rent' : 'badge-sale'}" style="margin-left:0.4rem;">${isSeller ? 'SELLER VIEW' : 'BUYER VIEW'}</span>
        </div>
        <span class="text-cyan" style="font-size:0.85rem;font-weight:700;">Closing: ${t.proposed_closing_date || 'Oct 2026'}</span>
      </div>

      <!-- Property Summary -->
      <div class="deal-prop-info">
        <img src="${t.primary_image || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=300&q=80'}" class="deal-prop-thumb" alt="Property">
        <div>
          <h4 style="font-size:1.1rem;margin-bottom:0.25rem;"><a href="/property-details.html?id=${t.property_id}" target="_blank">${t.property_title}</a></h4>
          <span class="text-secondary" style="font-size:0.85rem;"><i class="fas fa-map-marker-alt text-cyan"></i> ${t.property_city}</span>
        </div>
      </div>

      <!-- Financial Metrics Box -->
      <div class="deal-metrics-box">
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

    activeDeals = data.data || [];

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
        <p class="text-rose">Error: ${escapeHtml(err.message)}</p>
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
  const isCompleted = (t.status || '').toLowerCase() === 'completed';

  const stepperHtml = STAGES.map((s, idx) => {
    let cls = '';
    if (idx < stageIdx || isCompleted) cls = 'completed';
    else if (idx === stageIdx) cls = 'active';

    return `
      <div class="deal-step ${cls}">
        <div class="deal-step-circle">${idx < stageIdx || isCompleted ? '<i class="fas fa-check"></i>' : idx + 1}</div>
        <div class="deal-step-label">${s.label}</div>
      </div>
    `;
  }).join('');

  const priceNum = Number(t.offer_amount || 0);
  const depositNum = Number(t.deposit_amount || 0);
  const priceDisplay = priceNum >= 10000000 ? `₹${(priceNum / 10000000).toFixed(2)} Cr` : (priceNum >= 100000 ? `₹${(priceNum / 100000).toFixed(2)} Lakhs` : `₹${priceNum.toLocaleString()}`);
  const depositDisplay = depositNum >= 100000 ? `₹${(depositNum / 100000).toFixed(2)} Lakhs` : `₹${depositNum.toLocaleString()}`;

  return `
    <div class="glass-card deal-card" id="deal-card-${t.id}">
      <div class="deal-card-header">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="badge ${isCompleted ? 'badge-verified' : 'badge-trust'}">HS-TX-${t.id}-2026</span>
          <span class="badge ${isSeller ? 'badge-rent' : 'badge-sale'}">${isSeller ? 'SELLER VIEW' : 'BUYER VIEW'}</span>
          <span class="badge ${isCompleted ? 'badge-verified' : 'badge-pending'}">${(t.status || 'ACTIVE').toUpperCase()}</span>
        </div>
        <span class="text-cyan" style="font-size:0.85rem; font-weight:700;">
          <i class="far fa-calendar-alt"></i> ${t.proposed_closing_date ? new Date(t.proposed_closing_date).toLocaleDateString() : 'Active Escrow'}
        </span>
      </div>

      <!-- Property Summary -->
      <div class="deal-prop-info">
        <img src="${t.primary_image || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=300&q=80'}" class="deal-prop-thumb" alt="Property">
        <div>
          <h4 style="font-size:1.1rem; margin-bottom:0.25rem;"><a href="/property-details.html?id=${t.property_id}" target="_blank">${escapeHtml(t.property_title)}</a></h4>
          <span class="text-secondary" style="font-size:0.85rem;"><i class="fas fa-map-marker-alt text-cyan"></i> ${escapeHtml(t.property_city || 'Coimbatore')}</span>
        </div>
      </div>

      <!-- Financial Metrics Box -->
      <div class="deal-metrics-box" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem; background:var(--bg-surface-alt); padding:0.75rem 1rem; border-radius:var(--radius-sm); margin:1rem 0;">
        <div>
          <span class="text-muted" style="font-size:0.75rem; display:block;">Agreed Price</span>
          <strong style="font-size:1rem; color:var(--text-primary);">${priceDisplay}</strong>
        </div>
        <div>
          <span class="text-muted" style="font-size:0.75rem; display:block;">Escrow Deposit</span>
          <strong style="font-size:1rem; color:var(--accent-cyan);">${depositDisplay}</strong>
        </div>
        <div>
          <span class="text-muted" style="font-size:0.75rem; display:block;">Deal Type</span>
          <strong style="font-size:1rem; color:var(--accent-emerald); text-transform:uppercase;">${t.deal_type || 'BUY'}</strong>
        </div>
      </div>

      <!-- Stepper Pipeline -->
      <div class="deal-stepper" style="display:flex; justify-content:space-between; margin:1.25rem 0; overflow-x:auto; padding-bottom:0.5rem;">
        ${stepperHtml}
      </div>

      <!-- Deal Actions -->
      <div class="deal-actions-bar" style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-top:1rem; border-top:1px solid var(--border-color); padding-top:0.75rem; flex-wrap:wrap;">
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="viewTransactionReport(${t.id})">
            <i class="fas fa-file-invoice text-cyan"></i> View Transaction Report
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="printTransactionReport(${t.id})">
            <i class="fas fa-print"></i> Download / Print
          </button>
        </div>

        <div>
          ${!isCompleted ? `
            <button type="button" class="btn btn-primary btn-sm" onclick="markDealCompleted(${t.id})">
              <i class="fas fa-check-circle"></i> Complete Deal
            </button>
          ` : `
            <span class="badge badge-verified" style="padding:0.4rem 0.8rem; font-size:0.85rem;">
              <i class="fas fa-shield-check"></i> Deal Finalized
            </span>
          `}
        </div>
      </div>
    </div>
  `;
}

// View Transaction Summary Report in Modal
window.viewTransactionReport = async function(txId) {
  const token = localStorage.getItem('homesphere_token');
  if (!token) return;

  let modal = document.getElementById('transactionReportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'transactionReportModal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content glass-card" style="max-width:700px; width:92%; max-height:90vh; overflow-y:auto; padding:2rem;">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const res = await fetch(`/api/transactions/${txId}/report`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Could not fetch transaction report.');
    }

    const r = data.data;
    const f = r.financial_summary;
    const p = r.property;

    modal.innerHTML = `
      <div class="modal-content glass-card" style="max-width:720px; width:92%; max-height:90vh; overflow-y:auto; padding:2rem; position:relative;">
        <button type="button" onclick="closeReportModal()" style="position:absolute; right:1.25rem; top:1.25rem; background:none; border:none; color:var(--text-muted); font-size:1.25rem; cursor:pointer;">&times;</button>
        
        <div style="text-align:center; border-bottom:2px solid var(--border-color); padding-bottom:1.25rem; margin-bottom:1.5rem;">
          <div style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:800; font-size:1.2rem; color:var(--text-primary); margin-bottom:0.25rem;">
            <i class="fas fa-cube text-cyan"></i> HOMESPHERE
          </div>
          <h2 style="font-size:1.35rem; margin-bottom:0.25rem;">PROPERTY TRANSACTION SUMMARY</h2>
          <span class="badge badge-trust" style="font-size:0.8rem;">TRANSACTION ID: ${r.transaction_id}</span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem; font-size:0.875rem;">
          <div>
            <strong style="color:var(--text-secondary); display:block;">Transaction Date:</strong>
            <span>${new Date(r.transaction_date).toLocaleDateString()}</span>
          </div>
          <div>
            <strong style="color:var(--text-secondary); display:block;">Status:</strong>
            <span class="badge badge-verified">${r.status}</span>
          </div>
          <div>
            <strong style="color:var(--text-secondary); display:block;">Buyer:</strong>
            <span>${escapeHtml(r.buyer.name)} (${r.buyer.role})</span>
          </div>
          <div>
            <strong style="color:var(--text-secondary); display:block;">Seller:</strong>
            <span>${escapeHtml(r.seller.name)} (${r.seller.role})</span>
          </div>
        </div>

        <div style="background:var(--bg-surface-alt); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1.5rem;">
          <h4 style="margin-bottom:0.5rem; font-size:0.95rem;"><i class="fas fa-home text-cyan"></i> Property Details</h4>
          <p style="font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">${escapeHtml(p.title)}</p>
          <p class="text-secondary" style="font-size:0.85rem; margin-bottom:0.25rem;">${escapeHtml(p.address)}, ${escapeHtml(p.locality || p.city)}, ${escapeHtml(p.state)}</p>
          <div style="display:flex; gap:1rem; font-size:0.8rem; color:var(--text-muted);">
            <span><strong>Category:</strong> ${p.category}</span>
            <span><strong>Specs:</strong> ${p.bedrooms} BHK (${p.area_sqft})</span>
          </div>
        </div>

        <div style="background:var(--bg-surface-alt); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1.5rem;">
          <h4 style="margin-bottom:0.75rem; font-size:0.95rem;"><i class="fas fa-coins text-amber"></i> Financial Breakdown</h4>
          <div style="display:flex; justify-content:space-between; padding:0.3rem 0; font-size:0.875rem; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>Agreed Purchase / Base Price:</span>
            <strong>₹${Number(f.agreed_price).toLocaleString()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.3rem 0; font-size:0.875rem; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>Stamp Duty Charge (Recorded):</span>
            <span>₹${Number(f.stamp_duty_charge).toLocaleString()}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.3rem 0; font-size:0.875rem; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>Sub-Registrar Registration Fee:</span>
            <span>₹${Number(f.registration_charge).toLocaleString()}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.3rem 0; font-size:0.875rem; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>Annual Maintenance Contingency:</span>
            <span>₹${Number(f.maintenance_annual).toLocaleString()}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.5rem 0; font-size:1rem; font-weight:800; color:var(--accent-emerald); margin-top:0.25rem;">
            <span>Total Recorded Outlay:</span>
            <span>₹${Number(f.total_transaction_amount).toLocaleString()}</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.5rem; text-align:center; margin-bottom:1.5rem;">
          <div style="background:rgba(99,102,241,0.08); padding:0.6rem; border-radius:6px;">
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Trust Score</span>
            <strong style="color:var(--accent-cyan);">${r.decision_snapshot.trust_score}</strong>
          </div>
          <div style="background:rgba(16,185,129,0.08); padding:0.6rem; border-radius:6px;">
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Green Score</span>
            <strong style="color:var(--accent-emerald);">${r.decision_snapshot.green_living_score}</strong>
          </div>
          <div style="background:rgba(245,158,11,0.08); padding:0.6rem; border-radius:6px;">
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Locality Score</span>
            <strong style="color:var(--accent-amber);">${r.decision_snapshot.locality_life_score}</strong>
          </div>
        </div>

        <!-- Mandatory Legal Label -->
        <div style="background:rgba(239, 68, 68, 0.08); border-left:3px solid var(--accent-rose); padding:0.75rem 1rem; border-radius:4px; font-size:0.78rem; color:var(--text-secondary); margin-bottom:1.5rem; line-height:1.4;">
          <strong>Legal Notice:</strong> ${escapeHtml(r.legal_disclaimer)}
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeReportModal()">Close</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="printTransactionReport(${txId})">
            <i class="fas fa-print"></i> Print / Download PDF
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    modal.innerHTML = `
      <div class="modal-content glass-card" style="padding:2rem; text-align:center;">
        <p class="text-rose">${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:1rem;" onclick="closeReportModal()">Close</button>
      </div>
    `;
  }
};

window.closeReportModal = function() {
  const modal = document.getElementById('transactionReportModal');
  if (modal) modal.style.display = 'none';
};

// Print / Download Purchase Report Handler
window.printTransactionReport = async function(txId) {
  const token = localStorage.getItem('homesphere_token');
  if (!token) return;

  try {
    const res = await fetch(`/api/transactions/${txId}/report`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success || !data.data) throw new Error('Report data not available.');

    const r = data.data;
    const p = r.property;
    const f = r.financial_summary;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${r.report_title} - ${r.transaction_id}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 25px; }
          .brand { font-size: 24px; font-weight: 800; color: #0284c7; }
          .badge { display: inline-block; padding: 4px 10px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: 700; font-size: 12px; margin-top: 5px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 14px; }
          .section-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
          .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
          .row.total { font-weight: 800; font-size: 16px; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 8px; color: #059669; }
          .disclaimer { background: #fff1f2; border-left: 4px solid #e11d48; padding: 12px; font-size: 12px; color: #881337; margin-top: 25px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">HOMESPHERE AI PLATFORM</div>
          <h2 style="margin: 5px 0;">${r.report_title}</h2>
          <div class="badge">${r.transaction_id} &bull; ${r.status}</div>
        </div>

        <div class="grid-2">
          <div><strong>Date:</strong> ${new Date(r.transaction_date).toLocaleDateString()}</div>
          <div><strong>Deal Type:</strong> ${r.deal_type}</div>
          <div><strong>Buyer:</strong> ${r.buyer.name} (${r.buyer.role})</div>
          <div><strong>Seller:</strong> ${r.seller.name} (${r.seller.role})</div>
        </div>

        <div class="section-box">
          <div class="section-title">Property Details</div>
          <div style="font-weight: 700; font-size: 15px;">${p.title}</div>
          <div style="color: #64748b; font-size: 13px; margin-bottom: 8px;">${p.address}, ${p.locality || p.city}, ${p.state}</div>
          <div class="row"><span>Category / Subtype:</span><span>${p.category} &bull; ${p.subcategory}</span></div>
          <div class="row"><span>Specifications:</span><span>${p.bedrooms} BHK (${p.area_sqft})</span></div>
        </div>

        <div class="section-box">
          <div class="section-title">Financial Outlay Summary</div>
          <div class="row"><span>Agreed Price:</span><span>₹${Number(f.agreed_price).toLocaleString()}</span></div>
          <div class="row"><span>Recorded Stamp Duty:</span><span>₹${Number(f.stamp_duty_charge).toLocaleString()}</span></div>
          <div class="row"><span>Sub-Registrar Registration Fee:</span><span>₹${Number(f.registration_charge).toLocaleString()}</span></div>
          <div class="row"><span>Annual Maintenance Contingency:</span><span>₹${Number(f.maintenance_annual).toLocaleString()}</span></div>
          <div class="row total"><span>Total Recorded Outlay:</span><span>₹${Number(f.total_transaction_amount).toLocaleString()}</span></div>
        </div>

        <div class="section-box">
          <div class="section-title">HomeSphere Intelligence Scores</div>
          <div class="row"><span>Trust & Verification Rating:</span><span>${r.decision_snapshot.trust_score}</span></div>
          <div class="row"><span>Green Living & Sustainability:</span><span>${r.decision_snapshot.green_living_score}</span></div>
          <div class="row"><span>Locality LifeScore:</span><span>${r.decision_snapshot.locality_life_score}</span></div>
        </div>

        <div class="disclaimer">
          <strong>LEGAL NOTICE:</strong> ${r.legal_disclaimer}
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Mark Deal Completed Handler
window.markDealCompleted = async function(txId) {
  const token = localStorage.getItem('homesphere_token');
  if (!token) return;

  if (!confirm('Mark this real estate transaction as fully COMPLETED? This will finalize milestones and archive the property listing.')) return;

  try {
    const res = await fetch(`/api/transactions/${txId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'completed', notes: 'Digital escrow closing and purchase report generated.' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update transaction status.');

    showToast('Transaction successfully completed! Purchase report is ready.', 'success');
    await loadMyDeals(token);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  console.log(`[Toast ${type}] ${msg}`);
}
// HomeSphere Admin Dashboard & Management Console Logic

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const user = JSON.parse(localStorage.getItem('homesphere_user') || 'null');

  if (!token || !user || user.role !== 'admin') {
    showToast('Administrator privileges required. Redirecting...', 'error');
    setTimeout(() => { window.location.href = '/login.html'; }, 1000);
    return;
  }

  const page = window.location.pathname;

  if (page.includes('admin-dashboard.html')) {
    await loadAdminDashboardStats(token);
  } else if (page.includes('manage-users.html')) {
    await loadUsersTable(token);
  } else if (page.includes('manage-properties.html')) {
    await loadPropertiesTable(token);
  } else if (page.includes('verification.html')) {
    await loadVerificationQueue(token);
  }
});

// 1. Admin Dashboard KPI Statistics
async function loadAdminDashboardStats(token) {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      const stats = data.data;

      // KPIs
      document.getElementById('totalUsersCount').textContent = stats.users?.total_users || 0;
      document.getElementById('totalPropsCount').textContent = stats.properties?.total_properties || 0;
      document.getElementById('pendingDocsCount').textContent = stats.documents?.pending_verification || 0;
      document.getElementById('totalInquiriesCount').textContent = stats.inquiries?.total_inquiries || 0;

      // Recent Admin Actions Log
      const logContainer = document.getElementById('recentActionsLog');
      if (logContainer && stats.recent_actions) {
        logContainer.innerHTML = stats.recent_actions.map((act) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border-color);font-size:0.88rem;">
            <div>
              <span class="badge badge-trust">${act.action_type}</span>
              <span style="margin-left:0.5rem;">${act.notes}</span>
            </div>
            <span class="text-muted" style="font-size:0.78rem;">${new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    showToast('Failed to load admin metrics: ' + err.message, 'error');
  }
}

// 2. Manage Users Table
async function loadUsersTable(token) {
  const tableBody = document.getElementById('usersTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div></td></tr>';

  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.data) {
      const users = data.data;
      tableBody.innerHTML = users.map((u) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <img src="${u.avatar_url || '/images/users/default-avatar.png'}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
              <div>
                <strong>${u.name}</strong><br>
                <span class="text-muted" style="font-size:0.8rem;">#${u.id}</span>
              </div>
            </div>
          </td>
          <td>${u.email}</td>
          <td>
            <select onchange="updateUserRole(${u.id}, this.value)" class="form-select" style="padding:0.35rem 0.6rem;font-size:0.85rem;width:auto;">
              <option value="buyer" ${u.role === 'buyer' ? 'selected' : ''}>Buyer</option>
              <option value="seller" ${u.role === 'seller' ? 'selected' : ''}>Seller/Agent</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>${u.property_count || 0} listings</td>
          <td><span class="status-tag status-${u.status}">${u.status.toUpperCase()}</span></td>
          <td>
            ${u.status === 'active' ? `
              <button class="btn btn-secondary btn-sm text-rose" onclick="updateUserStatus(${u.id}, 'banned')">Ban</button>
            ` : `
              <button class="btn btn-secondary btn-sm text-emerald" onclick="updateUserStatus(${u.id}, 'active')">Activate</button>
            `}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-rose text-center">Error loading users.</td></tr>`;
  }
}

async function updateUserRole(userId, role) {
  const token = localStorage.getItem('homesphere_token');
  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (data.success) showToast(data.message, 'success');
  } catch (err) {
    showToast('Failed to update role.', 'error');
  }
}

async function updateUserStatus(userId, status) {
  const token = localStorage.getItem('homesphere_token');
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadUsersTable(token);
    }
  } catch (err) {
    showToast('Failed to update status.', 'error');
  }
}

// 3. Manage Properties Table
async function loadPropertiesTable(token) {
  const tableBody = document.getElementById('propertiesTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div></td></tr>';

  try {
    const res = await fetch('/api/admin/properties', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.data) {
      const properties = data.data;
      if (properties.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No properties found in database.</td></tr>';
        return;
      }

      tableBody.innerHTML = properties.map((p) => `
        <tr>
          <td>
            <strong><a href="/property-details.html?id=${p.id}" target="_blank" style="color:var(--text-primary);text-decoration:none;">${p.title}</a></strong><br>
            <span class="text-muted" style="font-size:0.8rem;"><i class="fas fa-map-marker-alt"></i> ${p.locality || p.city || 'Coimbatore'} | ₹${Number(p.price).toLocaleString('en-IN')}</span>
          </td>
          <td>
            <span>${p.owner_name || 'Owner'}</span><br>
            <span class="text-muted" style="font-size:0.75rem;">${p.owner_email || ''}</span>
          </td>
          <td>
            <span class="badge badge-trust">${p.trust_score || 90}/100</span>
          </td>
          <td>
            <span class="text-muted" style="font-size:0.8rem;">${p.verified_doc_count || 0} / ${p.doc_count || 0} Verified</span>
          </td>
          <td>
            <span class="status-tag status-${p.status}">${(p.status || 'active').toUpperCase()}</span>
          </td>
          <td>
            <select onchange="updatePropertyStatus(${p.id}, this.value)" class="form-select" style="padding:0.35rem 0.6rem;font-size:0.85rem;width:auto;">
              <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="pending" ${p.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="sold" ${p.status === 'sold' ? 'selected' : ''}>Sold</option>
              <option value="rented" ${p.status === 'rented' ? 'selected' : ''}>Rented</option>
              <option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Reject</option>
            </select>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="6" class="text-rose text-center">Error loading properties inventory.</td></tr>';
  }
}

async function updatePropertyStatus(propertyId, status) {
  const token = localStorage.getItem('homesphere_token');
  try {
    const res = await fetch(`/api/admin/properties/${propertyId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadPropertiesTable(token);
    }
  } catch (err) {
    showToast('Failed to update property status.', 'error');
  }
}

// 4. Verification Queue
async function loadVerificationQueue(token) {
  const queueList = document.getElementById('verificationQueueList');
  if (!queueList) return;

  queueList.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

  try {
    const res = await fetch('/api/admin/verification-queue', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.data) {
      const queue = data.data;
      if (queue.length === 0) {
        queueList.innerHTML = '<div class="glass-card" style="padding:2rem;text-align:center;color:var(--text-muted);">All uploaded documents are verified! Queue is clean.</div>';
        return;
      }

      queueList.innerHTML = queue.map((doc) => `
        <div class="glass-card" style="padding:1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
          <div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
              <span class="badge badge-trust">${(doc.doc_type || 'Title Deed').toUpperCase()}</span>
              <strong>${doc.property_title || 'Property #' + doc.property_id}</strong>
            </div>
            <p class="text-muted" style="font-size:0.82rem;margin:0;">
              Owner: <strong>${doc.owner_name || 'User'}</strong> (${doc.owner_email || ''}) | Location: ${doc.property_city || 'Coimbatore'}
            </p>
            ${doc.file_url ? `<a href="${doc.file_url}" target="_blank" class="text-emerald" style="font-size:0.8rem;text-decoration:underline;margin-top:0.25rem;display:inline-block;"><i class="fas fa-file-pdf"></i> View Uploaded Document</a>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <span class="status-tag status-${doc.verified_status}">${(doc.verified_status || 'pending').toUpperCase()}</span>
            ${doc.verified_status !== 'verified' ? `
              <button class="btn btn-secondary btn-sm text-emerald" onclick="verifyDocument(${doc.id}, 'verified')"><i class="fas fa-check"></i> Approve</button>
            ` : ''}
            ${doc.verified_status !== 'rejected' ? `
              <button class="btn btn-secondary btn-sm text-rose" onclick="verifyDocument(${doc.id}, 'rejected')"><i class="fas fa-times"></i> Reject</button>
            ` : ''}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    queueList.innerHTML = '<div class="glass-card text-rose" style="padding:1.5rem;text-align:center;">Failed to load verification queue.</div>';
  }
}

async function verifyDocument(docId, verified_status) {
  const token = localStorage.getItem('homesphere_token');
  try {
    const res = await fetch(`/api/admin/verify-document/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ verified_status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadVerificationQueue(token);
    }
  } catch (err) {
    showToast('Failed to verify document.', 'error');
  }
}

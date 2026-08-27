/**
 * HomeSphere - Profile Controller (Single User Model)
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

  if (user) {
    if (document.getElementById('profName') && user.name) document.getElementById('profName').value = user.name;
    if (document.getElementById('profEmail') && user.email) document.getElementById('profEmail').value = user.email;
    if (document.getElementById('profPhone') && user.phone) document.getElementById('profPhone').value = user.phone;
    if (document.getElementById('profileDisplayName') && user.name) document.getElementById('profileDisplayName').textContent = user.name;
    if (document.getElementById('profileAvatarInit') && user.name) document.getElementById('profileAvatarInit').textContent = user.name.charAt(0).toUpperCase();
  }

  // Load User Real Activity Stats
  try {
    const res = await fetch('/api/users/dashboard-stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      const stats = data.data;
      const totalListed = (stats.properties_for_sale || 0) + (stats.properties_for_rent || 0);
      if (document.getElementById('profStatListed')) document.getElementById('profStatListed').textContent = totalListed;
      if (document.getElementById('profStatSaved')) document.getElementById('profStatSaved').textContent = stats.saved_properties || 0;
      if (document.getElementById('profStatCompare')) {
        const compIds = JSON.parse(localStorage.getItem('homesphere_compare') || '[]');
        document.getElementById('profStatCompare').textContent = compIds.length;
      }
      if (document.getElementById('profStatMessages')) document.getElementById('profStatMessages').textContent = stats.unread_messages || 0;
    }
  } catch (err) {
    console.error('Failed to load profile stats:', err);
  }
});

function handleSaveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profName').value.trim();
  const email = document.getElementById('profEmail').value.trim();
  const phone = document.getElementById('profPhone').value.trim();

  const user = {
    name,
    email,
    phone,
    role: 'user'
  };

  localStorage.setItem('homesphere_user', JSON.stringify(user));
  document.getElementById('profileDisplayName').textContent = name;
  if (document.getElementById('profileAvatarInit') && name) {
    document.getElementById('profileAvatarInit').textContent = name.charAt(0).toUpperCase();
  }
  showToast('Profile and preferences updated successfully!', 'success');
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

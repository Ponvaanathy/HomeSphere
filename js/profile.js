/**
 * HomeSphere - Profile Controller (Real Data & Authentication)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  syncNavbar(token);
  await loadUserProfile(token);
});

/**
 * 1. Synchronize Top Navbar Auth State
 */
function syncNavbar(token) {
  const brandLogoLink = document.getElementById('brandLogoLink');
  if (brandLogoLink) brandLogoLink.href = '/dashboard.html';

  const userStr = localStorage.getItem('homesphere_user');
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      updateNavUserUI(u);
    } catch (e) {}
  }
}

function updateNavUserUI(user) {
  if (!user || !user.name) return;
  const nameEl = document.getElementById('navHeaderUserName');
  const avatarEl = document.getElementById('navAvatarInitial');
  const roleEl = document.getElementById('navUserRoleBadge');

  if (nameEl) nameEl.textContent = user.name;
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  if (roleEl && user.role) {
    roleEl.textContent = formatRole(user.role);
  }
}

/**
 * 2. Load Real User Profile & Stats from Backend
 */
async function loadUserProfile(token) {
  try {
    const res = await fetch('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('homesphere_token');
      localStorage.removeItem('homesphere_user');
      window.location.href = '/login.html';
      return;
    }

    const json = await res.json();
    if (json.success && json.data) {
      const user = json.data;

      // Update LocalStorage Cache
      localStorage.setItem('homesphere_user', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar_url: user.avatar_url
      }));

      // 1. Hero Header
      const heroName = document.getElementById('profileHeroName');
      const heroEmail = document.getElementById('profileHeroEmail');
      const heroRole = document.getElementById('profileHeroRoleBadge');
      const heroLoc = document.getElementById('profileHeroLocation');
      const heroJoined = document.getElementById('profileHeroJoined');
      const heroAvatar = document.getElementById('profileHeroAvatar');
      const heroAvatarText = document.getElementById('profileHeroAvatarText');

      if (heroName) heroName.textContent = user.name || 'HomeSphere User';
      if (heroEmail) heroEmail.textContent = user.email || '';
      if (heroRole) heroRole.textContent = formatRole(user.role);
      if (heroLoc) heroLoc.textContent = user.location || 'Coimbatore, Tamil Nadu';
      if (heroJoined && user.created_at) {
        const joinDate = new Date(user.created_at);
        heroJoined.textContent = joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      if (heroAvatarText) {
        heroAvatarText.textContent = (user.name || 'U').charAt(0).toUpperCase();
      }

      // 2. Stats Boxes
      const listingsEl = document.getElementById('profListingsCount');
      const savedEl = document.getElementById('profSavedCount');
      const compareEl = document.getElementById('profCompareCount');

      if (listingsEl) listingsEl.textContent = user.listings_count ?? 0;
      if (savedEl) savedEl.textContent = user.saved_count ?? 0;
      if (compareEl) {
        try {
          const comp = JSON.parse(localStorage.getItem('homesphere_compare') || '[]');
          compareEl.textContent = comp.length;
        } catch (e) {
          compareEl.textContent = '0';
        }
      }

      // 3. Edit Form Inputs
      const nameInput = document.getElementById('profName');
      const emailInput = document.getElementById('profEmail');
      const phoneInput = document.getElementById('profPhone');
      const locInput = document.getElementById('profLocation');

      if (nameInput) nameInput.value = user.name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (phoneInput) phoneInput.value = user.phone || '';
      if (locInput) locInput.value = user.location || '';

      updateNavUserUI(user);
    }
  } catch (err) {
    console.error('Error fetching user profile:', err);
    showToast('Could not load profile information.', 'error');
  }
}

/**
 * 3. Save Profile Changes (PUT /api/users/profile)
 */
async function handleSaveProfile(e) {
  e.preventDefault();
  const token = localStorage.getItem('homesphere_token');
  if (!token) return;

  const name = document.getElementById('profName')?.value.trim();
  const phone = document.getElementById('profPhone')?.value.trim();
  const location = document.getElementById('profLocation')?.value.trim();
  const btnSave = document.getElementById('btnSaveProfile');

  if (!name) {
    showToast('Name cannot be empty.', 'warning');
    return;
  }

  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        phone,
        location
      })
    });

    const data = await res.json();
    if (data.success && data.data) {
      const updated = data.data;

      // Update LocalStorage
      const currentStored = JSON.parse(localStorage.getItem('homesphere_user') || '{}');
      localStorage.setItem('homesphere_user', JSON.stringify({
        ...currentStored,
        name: updated.name,
        phone: updated.phone
      }));

      // Update Hero and Navbar
      const heroName = document.getElementById('profileHeroName');
      const heroLoc = document.getElementById('profileHeroLocation');
      const heroAvatarText = document.getElementById('profileHeroAvatarText');

      if (heroName) heroName.textContent = updated.name;
      if (heroLoc) heroLoc.textContent = updated.location || location || 'Coimbatore, Tamil Nadu';
      if (heroAvatarText) heroAvatarText.textContent = updated.name.charAt(0).toUpperCase();

      updateNavUserUI(updated);
      showToast('Profile updated successfully!', 'success');
    } else {
      showToast(data.message || 'Failed to update profile.', 'error');
    }
  } catch (err) {
    console.error('Profile update failed:', err);
    showToast('Error saving profile changes.', 'error');
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="fas fa-check"></i> Save Changes';
    }
  }
}

/**
 * 4. Password Form Toggle & Submit
 */
function togglePasswordForm() {
  const section = document.getElementById('passwordFormSection');
  const btn = document.getElementById('btnTogglePasswordForm');
  if (!section) return;

  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? 'block' : 'none';
  if (btn) {
    btn.innerHTML = isHidden ? '<i class="fas fa-times"></i> Close Form' : '<i class="fas fa-lock"></i> Change Password';
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  const token = localStorage.getItem('homesphere_token');
  if (!token) return;

  const currentPassword = document.getElementById('currentPassword')?.value;
  const newPassword = document.getElementById('newPassword')?.value;
  const btnSubmit = document.getElementById('btnSubmitPassword');

  if (!currentPassword || !newPassword) {
    showToast('Please provide both current and new password.', 'warning');
    return;
  }

  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters.', 'warning');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Password changed successfully!', 'success');
      document.getElementById('changePasswordForm')?.reset();
      togglePasswordForm();
    } else {
      showToast(data.message || 'Failed to change password.', 'error');
    }
  } catch (err) {
    console.error('Password change error:', err);
    showToast('Failed to change password.', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fas fa-shield-alt"></i> Update Password';
    }
  }
}

/**
 * 5. Logout Handler
 */
function handleLogout() {
  localStorage.removeItem('homesphere_token');
  localStorage.removeItem('homesphere_user');
  window.location.href = '/login.html';
}

/**
 * 6. Utilities
 */
function formatRole(role) {
  if (!role) return 'Member Account';
  switch (role.toLowerCase()) {
    case 'seller': return 'Property Owner / Seller';
    case 'buyer': return 'Verified Buyer';
    case 'admin': return 'Platform Administrator';
    case 'agent': return 'Real Estate Agent';
    default: return 'Verified Member Account';
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
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;margin-left:auto;">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/**
 * HomeSphere - Centralized Authentication & Route Guard
 * Enforces authenticated access control across protected platform features and pages.
 */

(function () {
  const AuthGuard = {
    /**
     * Check if a valid session exists in client storage
     * @returns {boolean}
     */
    isAuthenticated() {
      try {
        const token = localStorage.getItem('homesphere_token');
        const userStr = localStorage.getItem('homesphere_user');
        if (!token || !userStr) return false;
        const user = JSON.parse(userStr);
        return Boolean(user && (user.id || user.email));
      } catch (e) {
        return false;
      }
    },

    /**
     * Get active authentication token
     * @returns {string|null}
     */
    getAuthToken() {
      return localStorage.getItem('homesphere_token') || null;
    },

    /**
     * Get active authenticated user profile object
     * @returns {object|null}
     */
    getAuthUser() {
      try {
        const userStr = localStorage.getItem('homesphere_user');
        return userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Require authentication on protected pages.
     * If user is not authenticated, redirects immediately to login with return target.
     * @param {string} [customRedirectUrl]
     * @returns {boolean} true if authenticated, false if redirecting
     */
    requireAuth(customRedirectUrl) {
      if (!this.isAuthenticated()) {
        const target = customRedirectUrl || (window.location.pathname + window.location.search + window.location.hash);
        // Avoid redirect loop if already on login or register
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
          const loginTarget = `/login.html?redirect=${encodeURIComponent(target)}`;
          window.location.replace(loginTarget);
          return false;
        }
      }
      return true;
    },

    /**
     * Terminate user session, clear credentials and redirect
     * @param {string} [destination='/login.html']
     */
    logout(destination = '/login.html') {
      try {
        localStorage.removeItem('homesphere_token');
        localStorage.removeItem('homesphere_user');
        localStorage.removeItem('homesphere_compare');
        sessionStorage.clear();
      } catch (e) {
        console.error('Logout cleanup error:', e);
      }
      window.location.replace(destination);
    },

    /**
     * Synchronize header navbar navigation and user avatar across pages
     */
    syncGlobalNavAuth() {
      const authActions = document.getElementById('navAuthActions');
      const brandLogoLink = document.getElementById('brandLogoLink') || document.querySelector('.nav-brand');

      if (this.isAuthenticated()) {
        const user = this.getAuthUser() || {};
        const userName = user.name || 'Account';
        const userInit = (user.name && user.name.charAt(0).toUpperCase()) || 'U';

        if (brandLogoLink) brandLogoLink.href = '/dashboard.html';

        if (authActions) {
          authActions.innerHTML = `
            <a href="/profile.html" class="nav-profile-header-link" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.25rem 0.65rem; border-radius: 50px; background: var(--bg-surface-alt, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); color: var(--text-primary, #0f172a); font-size: 0.8125rem; font-weight: 600;" title="View Profile">
              <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--brand-primary, #0284c7); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">${userInit}</div>
              <span class="hide-mobile">${userName}</span>
            </a>
            <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> <span class="hide-mobile">Dashboard</span></a>
            <button onclick="AuthGuard.logout()" class="btn btn-secondary btn-sm" title="Log Out" style="padding: 0.4rem 0.65rem;"><i class="fas fa-sign-out-alt"></i></button>
          `;
        }
      } else {
        if (brandLogoLink) brandLogoLink.href = '/index.html';

        if (authActions) {
          authActions.innerHTML = `
            <a href="/login.html" class="btn btn-secondary btn-sm">Sign In</a>
            <a href="/register.html" class="btn btn-primary btn-sm">Get Started</a>
          `;
        }
      }
    }
  };

  // Expose globally
  window.AuthGuard = AuthGuard;
  window.handleLogout = function () {
    AuthGuard.logout();
  };

  // Prevent browser back-button cache bypass on protected pages
  window.addEventListener('pageshow', function (event) {
    const isProtected = document.body && document.body.dataset && document.body.dataset.protected === 'true';
    if (isProtected && !AuthGuard.isAuthenticated()) {
      AuthGuard.requireAuth();
    }
  });

  // Auto-protect and auto-sync navbar when DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    const isProtected = document.body && document.body.dataset && document.body.dataset.protected === 'true';
    if (isProtected && !AuthGuard.isAuthenticated()) {
      AuthGuard.requireAuth();
      return;
    }
    AuthGuard.syncGlobalNavAuth();
  });
})();

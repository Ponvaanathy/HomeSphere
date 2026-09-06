/**
 * HomeSphere - Frontend Production Runtime Configuration
 * 
 * Target Production Backend: https://home-sphere-c184.onrender.com
 * Target Production Frontend: https://home-sphere-hub.vercel.app
 */

(function () {
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '5000';

  const BACKEND_BASE = isLocal
    ? 'http://localhost:5000'
    : 'https://home-sphere-c184.onrender.com';

  window.API_BASE_URL = BACKEND_BASE;
  window.HOMESPHERE_CONFIG = {
    API_BASE_URL: `${BACKEND_BASE}/api`,
    BACKEND_URL: BACKEND_BASE,
    APP_NAME: 'HomeSphere',
    VERSION: '1.0.0'
  };
})();

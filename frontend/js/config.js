/**
 * HomeSphere - Frontend Runtime Configuration
 * Dynamically resolves API and Backend URLs based on environment or settings.
 */

window.HOMESPHERE_CONFIG = (function() {
  // If served from the same host (e.g., Express server or Vercel proxy)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Base configuration
  const config = {
    // Relative '/api' works automatically when frontend and backend share the domain or use rewrites
    // If backend is deployed on a separate domain (e.g., Render), change this URL:
    API_BASE_URL: isLocal && window.location.port !== '5000' 
      ? 'http://localhost:5000/api' 
      : '/api',
    BACKEND_URL: isLocal && window.location.port !== '5000'
      ? 'http://localhost:5000'
      : window.location.origin,
    APP_NAME: 'HomeSphere',
    VERSION: '1.0.0'
  };

  return config;
})();

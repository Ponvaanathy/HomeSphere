/**
 * restore_full_system.js
 * Restores the complete Luxury Dark Glassmorphic HomeSphere platform
 * with full features, working routes, and high-contrast input readability.
 */

const fs = require('fs');
const path = require('path');

// 1. Restore css/style.css
const styleCss = `/* ==========================================================
   HOMESPHERE GLOBAL DESIGN SYSTEM & STYLES
   Aesthetic: Luxury Dark Glassmorphic with Indigo & Cyan Accents
   ========================================================== */

@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

:root {
  /* Color Tokens */
  --bg-primary: #070b14;
  --bg-secondary: #0d1527;
  --bg-card: rgba(18, 28, 48, 0.75);
  --bg-card-hover: rgba(28, 42, 70, 0.85);
  --bg-glass: rgba(15, 23, 42, 0.65);
  --bg-input: #ffffff;

  --border-color: rgba(255, 255, 255, 0.08);
  --border-highlight: rgba(99, 102, 241, 0.35);
  --border-glow: rgba(6, 182, 212, 0.4);

  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-light: #cbd5e1;

  --accent-primary: #6366f1;       /* Indigo */
  --accent-primary-hover: #4f46e5;
  --accent-cyan: #06b6d4;          /* Cyan */
  --accent-emerald: #10b981;       /* Emerald / Green Living */
  --accent-amber: #f59e0b;         /* Amber / Trust Warn */
  --accent-rose: #f43f5e;          /* Rose / Alert */
  --accent-purple: #a855f7;

  --gradient-primary: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
  --gradient-card: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
  --gradient-glow: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%);
  --gradient-emerald: linear-gradient(135deg, #10b981 0%, #059669 100%);

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.45);
  --shadow-glow: 0 0 30px rgba(99, 102, 241, 0.25);
  --shadow-glow-cyan: 0 0 30px rgba(6, 182, 212, 0.25);

  /* Typography */
  --font-heading: 'Outfit', sans-serif;
  --font-body: 'Plus Jakarta Sans', sans-serif;

  /* Layout */
  --max-width: 1320px;
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Global Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  background-image:
    radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 85% 65%, rgba(6, 182, 212, 0.07) 0%, transparent 45%);
  background-attachment: fixed;
}

a {
  color: inherit;
  text-decoration: none;
  transition: var(--transition-fast);
}

ul {
  list-style: none;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

button, input, select, textarea {
  font-family: inherit;
  font-size: inherit;
}

/* ==========================================================
   INPUT READABILITY FIX - HIGH CONTRAST & VISIBILITY
   ========================================================== */
input, select, textarea, .form-input, .form-select, .form-textarea, .chat-input, .filter-select, .search-input {
  background: #ffffff !important;
  color: #111827 !important;
  border: 1px solid #d1d5db !important;
  border-radius: var(--radius-sm);
  padding: 0.65rem 1rem;
  outline: none;
  font-size: 0.9375rem;
}

input:focus, select:focus, textarea:focus, .form-input:focus, .form-select:focus, .form-textarea:focus, .chat-input:focus {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
}

input::placeholder, textarea::placeholder, .form-input::placeholder, .form-textarea::placeholder, .chat-input::placeholder {
  color: #6b7280 !important;
  opacity: 1 !important;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-primary);
}

h1 { font-size: 2.75rem; letter-spacing: -0.02em; }
h2 { font-size: 2rem; letter-spacing: -0.015em; }
h3 { font-size: 1.5rem; }
h4 { font-size: 1.2rem; }

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.text-cyan { color: var(--accent-cyan); }
.text-emerald { color: var(--accent-emerald); }
.text-amber { color: var(--accent-amber); }
.text-rose { color: var(--accent-rose); }
.text-muted { color: var(--text-muted); }
.text-light { color: var(--text-light); }
.text-secondary { color: var(--text-secondary); }

/* Layout Containers */
.container {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1.5rem;
}

.main-content {
  flex: 1;
  padding-top: 5.5rem;
  padding-bottom: 4rem;
}

/* ==========================================================
   CARD SYSTEM & GLASSMORPHISM
   ========================================================== */
.glass-card, .card {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: var(--transition-normal);
}

.glass-card:hover, .card:hover {
  border-color: var(--border-highlight);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

/* ==========================================================
   BUTTONS
   ========================================================== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}

.btn-primary {
  background: var(--gradient-primary);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}
.btn-primary:hover {
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.55);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-highlight);
}

.btn-emerald {
  background: var(--gradient-emerald);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}
.btn-emerald:hover {
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.55);
  transform: translateY(-1px);
}

.btn-cyan {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  color: #ffffff;
}

.btn-sm {
  padding: 0.45rem 0.9rem;
  font-size: 0.85rem;
}

.btn-lg {
  padding: 0.95rem 2rem;
  font-size: 1.05rem;
}

/* ==========================================================
   BADGES & CHIPS
   ========================================================== */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-full);
}

.badge-trust, .badge-verified {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.badge-sale, .badge-green {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-rent, .badge-blue {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.badge-lease, .badge-amber {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-amber);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Score Pills */
.score-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
}

.score-pill.trust {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.score-pill.life {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.score-pill.match {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

/* ==========================================================
   NAVIGATION BAR
   ========================================================== */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4.5rem;
  background: rgba(7, 11, 20, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  z-index: 1000;
  display: flex;
  align-items: center;
}

.navbar .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.brand-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 1.1rem;
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-link {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.nav-link:hover, .nav-link.active {
  color: #ffffff;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* ==========================================================
   FOOTER
   ========================================================== */
.footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 4rem 0 2rem;
  margin-top: auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-col h4 {
  font-size: 1rem;
  margin-bottom: 1.25rem;
  color: #ffffff;
}

.footer-col ul li {
  margin-bottom: 0.75rem;
}

.footer-col ul li a {
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.footer-col ul li a:hover {
  color: #ffffff;
}

.footer-bottom {
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Toast Container */
#toast-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toast {
  background: rgba(13, 21, 39, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  color: #ffffff;
  padding: 1rem 1.5rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  animation: slideInRight 0.3s ease;
}

.toast-success { border-left: 4px solid var(--accent-emerald); }
.toast-error { border-left: 4px solid var(--accent-rose); }
.toast-info { border-left: 4px solid var(--accent-cyan); }

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
`;

fs.writeFileSync('C:/HomeSphere/css/style.css', styleCss, 'utf8');
console.log('✔ Restored css/style.css with Luxury Dark Theme & High Contrast Input Fix');

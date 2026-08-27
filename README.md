# HomeSphere — AI-Powered Real Estate Decision Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/Database-MySQL%20%2F%20phpMyAdmin-orange.svg)](https://www.mysql.com/)
[![JWT Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-red.svg)](https://jwt.io/)

**HomeSphere** is a production-ready, AI-powered real estate decision platform that helps buyers, renters, sellers, and agents discover, evaluate, compare, and list properties with complete trust transparency, legal DNA analysis, hidden closing cost projections, and conversational AI guidance.

---

## 🌟 Core Value Proposition

Unlike traditional real estate listing boards, HomeSphere focuses on **decision intelligence**:
1. **AI Trust Score (0–100)**: Quantitative composite audit evaluating freehold title deeds, municipal encumbrance filings, seller track records, and price sanity benchmarks.
2. **Property DNA Fingerprint**: Structured ledger recording building age, engineering envelope specifications, historical ownership chains, and architectural audit flags.
3. **Hidden Cost Transparency Engine**: First-year projection of statutory registration, stamp duty, maintenance reserves, and property taxes.
4. **Locality LifeScore & Green Living Rating**: Livability indices analyzing neighborhood safety, school zones, transit proximity, and eco-infrastructure (solar arrays, AQI).
5. **Multi-Property Comparison Matrix**: Side-by-side evaluation of up to 4 properties with highlight best indicators.
6. **Conversational AI Home Advisor**: Chat assistant answering inquiries regarding legal safety, buy vs rent trade-offs, and 5-year capital appreciation projections.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Vanilla Glassmorphism & Custom Properties), ES6 Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL (XAMPP / MariaDB / phpMyAdmin compatible) |
| **Authentication** | JWT (JSON Web Tokens) with `bcryptjs` password hashing |
| **File Storage** | Multer disk storage for property photos, avatars, and PDF documents |
| **AI Layer** | Modular deterministic heuristic scoring engine annotated with `// AI_HOOK` points for live LLM API swapping |

---

## 📁 Project Structure

```
HomeSphere/
│
├── index.html                  # Landing page & instant discovery search
├── login.html                  # Auth sign-in with 1-click demo switcher
├── register.html               # Multi-role account creation (Buyer / Seller)
├── dashboard.html              # Personalized user intelligence & AI match feed
├── properties.html             # Advanced filter sidebar, sorting & pagination
├── property-details.html       # Full property view + Trust Score + DNA + Calculator
├── list-property.html          # 4-step property publishing wizard
├── saved.html                  # Saved collection & comparison launcher
├── compare.html                # Side-by-side 4-column comparison matrix
├── advisor.html                # Conversational AI Home Advisor chat UI
├── profile.html                # User details & AI lifestyle preference sliders
├── contact.html                # Contact support & FAQ accordion
│
├── admin/
│   ├── admin-dashboard.html    # Platform KPI statistics & audit log
│   ├── manage-users.html       # User role management & account ban/activate
│   ├── manage-properties.html  # Listing approvals & status manager
│   └── verification.html       # Title deed verification queue & Trust Score recalculator
│
├── css/
│   ├── style.css               # Global design tokens, navbar, footer, modals
│   ├── login.css
│   ├── register.css
│   ├── dashboard.css
│   ├── properties.css
│   ├── property-details.css
│   ├── list-property.css
│   ├── saved.css
│   ├── compare.css
│   ├── advisor.css
│   ├── profile.css
│   ├── contact.css
│   └── admin.css
│
├── js/
│   ├── login.js
│   ├── register.js
│   ├── dashboard.js
│   ├── properties.js
│   ├── property-details.js
│   ├── list-property.js
│   ├── saved.js
│   ├── compare.js
│   ├── advisor.js
│   ├── profile.js
│   ├── contact.js
│   └── admin.js
│
├── backend/
│   ├── server.js               # Express application entry point
│   ├── package.json            # Node.js dependencies
│   ├── .env                    # Environment variables configuration
│   ├── config/
│   │   └── db.js               # MySQL connection pool
│   ├── middleware/
│   │   ├── authMiddleware.js   # JWT authentication
│   │   ├── adminMiddleware.js  # Administrator route protection
│   │   ├── uploadMiddleware.js # Multer file upload handling
│   │   └── errorMiddleware.js  # Centralized error handler
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── propertyController.js
│   │   ├── searchController.js
│   │   ├── compareController.js
│   │   ├── savedController.js
│   │   ├── contactController.js
│   │   ├── adminController.js
│   │   └── aiController.js     # 10 Isolated AI service functions
│   └── routes/
│       ├── authRoutes.js
│       ├── userRoutes.js
│       ├── propertyRoutes.js
│       ├── searchRoutes.js
│       ├── compareRoutes.js
│       ├── savedRoutes.js
│       ├── contactRoutes.js
│       ├── adminRoutes.js
│       └── aiRoutes.js
│
├── database/
│   └── homesphere.sql          # Full MySQL schema & rich seed data
│
├── images/
│   ├── properties/
│   ├── users/
│   └── logo/
│
├── README.md
└── .gitignore
```

---

## 🚀 Setup & Installation Instructions

### 1. Database Setup (XAMPP / MySQL / phpMyAdmin)
1. Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.
2. Open your browser and navigate to `http://localhost/phpmyadmin`.
3. Click on the **Import** tab.
4. Select `database/homesphere.sql` from this repository and click **Import** (or run `CREATE DATABASE homesphere;` and import).
5. The database `homesphere` with all 15 tables and realistic seed properties/users is now ready.

### 2. Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify your `backend/.env` file:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=
   DB_NAME=homesphere
   JWT_SECRET=homesphere_jwt_secret_key_ultra_secure_2026_antigravity
   NODE_ENV=development
   ```
4. Start the server:
   ```bash
   npm start
   ```
   Or for live reloading during development:
   ```bash
   npm run dev
   ```
5. The backend will be live at `http://localhost:5000`.

### 3. Frontend Access
Once the backend is running, open your web browser and navigate directly to:
👉 **`http://localhost:5000`**

---

## 🔑 Pre-Configured Demo Accounts

All demo accounts share the password: `password123`

| Role | Email | Password | Access Capabilities |
|---|---|---|---|
| **Administrator** | `admin@homesphere.com` | `password123` | Platform KPIs, Document Verification Queue, User Roles, Property Approvals |
| **Seller / Agent** | `seller@homesphere.com` | `password123` | Multi-step Property Listing Wizard, Manage Listings, Inquiries Received |
| **Buyer / Renter** | `buyer@homesphere.com` | `password123` | AI Recommendations, Saved Properties, Tour Bookings, AI Advisor |

*(Tip: On the `login.html` page, click any of the 1-click demo buttons to automatically populate credentials!)*

---

## 🧠 AI Features & `// AI_HOOK` Architecture

All 10 AI functions in `backend/controllers/aiController.js` are modularized and explicitly tagged with `// AI_HOOK: replace with LLM API call`:

1. `getPropertyMatch(userPrefs)`: Scores and ranks listings against user preferences.
2. `getAdvisorResponse(query, propertyId)`: Conversational Q&A synthesizing property context.
3. `calculateTrustScore(propertyId)`: Computes 0-100 composite trust and document verification rating.
4. `generatePropertyDNA(propertyId)`: Produces structured timeline, structural specs, and flags.
5. `calculateLifeScore(propertyId)`: Locality livability index (schools, safety, transit, walkability).
6. `calculateGreenScore(propertyId)`: Eco-sustainability rating (energy rating, solar array, AQI).
7. `estimateHiddenCosts(propertyId)`: Itemizes statutory registration, stamp duty, maintenance, and taxes.
8. `predictFutureValue(propertyId, years)`: Projects 5 and 10-year capital appreciation.
9. `getRecommendations(userId)`: Personalized recommendation blending user preferences.
10. `generateDecisionSummary(propertyId, userId)`: Plain-language one-paragraph verdict synthesis.

To connect Anthropic Claude or Gemini, simply replace the marked heuristic return blocks with your API client call.

---

## 🛡️ License
Distributed under the ISC License. HomeSphere 2026.

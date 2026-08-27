/**
 * seed_marketplace.js
 * Initializes database schema and seeds realistic, category-based marketplace properties
 * across Residential, Land & Plots, Commercial, PG & Rooms, and New Projects.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  console.log('====================================================');
  console.log('🚀 SEEDING HOMESPHERE MARKETPLACE & DECISION PLATFORM');
  console.log('====================================================\n');

  // 1. Run schema DDL
  const schemaPath = path.join(__dirname, '../../database/homesphere.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('1️⃣ Applying fresh database schema...');
  const cleanedSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log(' ✔ Database schema synchronized successfully.');

  // 2. Create Core Users
  console.log('\n2️⃣ Seeding platform users (Buyer, Tenant, Property Owner, Agent, Admin)...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const users = [
    { name: 'Karthik Raja', email: 'karthik@homesphere.com', phone: '+91 98450 12345', role: 'user', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' },
    { name: 'Ananya Sharma', email: 'ananya@homesphere.com', phone: '+91 97890 54321', role: 'user', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80' },
    { name: 'Rajesh Properties (Agent)', email: 'rajesh.agent@homesphere.com', phone: '+91 94430 98765', role: 'seller', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' },
    { name: 'HomeSphere Admin', email: 'admin@homesphere.com', phone: '+91 90000 00000', role: 'admin', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' }
  ];

  const userIds = {};
  for (const u of users) {
    const [res] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone, avatar_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role), phone=VALUES(phone), avatar_url=VALUES(avatar_url)`,
      [u.name, u.email, passwordHash, u.role, u.phone, u.avatar]
    );
    const [userRow] = await pool.query('SELECT id FROM users WHERE email = ?', [u.email]);
    userIds[u.email] = userRow[0].id;
  }
  console.log(` ✔ Seeded/Synced ${users.length} verified platform accounts.`);

  // 3. Seed Properties Across All 5 Flipkart-Style Categories
  console.log('\n3️⃣ Seeding realistic properties across all 5 Marketplace categories...');

  const properties = [
    // --- 1. RESIDENTIAL ---
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Modern 3BHK Luxury Apartment in Gated Community',
      description: 'Stunning 3BHK south-facing apartment in prime Peelamedu. High ceiling, Italian marble flooring, modular kitchen with chimney, 2 covered car parks, and 24/7 security with smart biometric access.',
      category: 'residential',
      subcategory: 'apartment',
      type: 'sale',
      property_type: 'apartment',
      price: 7500000, // ₹75 Lakhs
      deposit: 0,
      currency: 'INR',
      address: 'Near PSG Tech, Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.026700,
      lng: 77.002800,
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 1650,
      year_built: 2023,
      furnishing: 'semi-furnished',
      parking_spaces: 2,
      amenities: ['Clubhouse', 'Swimming Pool', 'Gymnasium', '24/7 Security', 'Power Backup', 'Children Play Area', 'EV Charging Point', 'Visitor Parking'],
      is_verified: 1,
      match_score: 96,
      trust_score: 93,
      life_score: 91,
      green_score: 86,
      hidden_costs: { reg: 75000, stamp: 525000, maint: 36000, tax: 12000, total: 648000 },
      images: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'karthik@homesphere.com',
      title: 'Grand 4BHK Independent Duplex Villa with Private Garden',
      description: 'Architect-designed contemporary villa featuring private landscaped garden, home theatre room, solar rooftop panel system, servant quarters, and imported teakwood fittings.',
      category: 'residential',
      subcategory: 'villa',
      type: 'sale',
      property_type: 'villa',
      price: 14500000, // ₹1.45 Cr
      deposit: 0,
      currency: 'INR',
      address: 'IT Corridor, Saravanampatti',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641035',
      lat: 11.082500,
      lng: 76.996100,
      bedrooms: 4,
      bathrooms: 4.5,
      bhk: 4,
      area_sqft: 3100,
      year_built: 2024,
      furnishing: 'fully-furnished',
      parking_spaces: 2,
      amenities: ['Private Garden', 'Home Theatre', 'Solar Net Metering', 'Smart Lock Automation', 'CCTV Surveillance', 'Water Softener', 'Balcony Deck'],
      is_verified: 1,
      match_score: 94,
      trust_score: 95,
      life_score: 89,
      green_score: 92,
      hidden_costs: { reg: 145000, stamp: 1015000, maint: 48000, tax: 24000, total: 1232000 },
      images: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'ananya@homesphere.com',
      title: 'Spacious 2BHK Semi-Furnished Flat for Rent',
      description: 'Peaceful residential neighborhood close to DB Road and commercial hub. Excellent ventilation, piped gas connection, covered bike & car parking, and low maintenance.',
      category: 'residential',
      subcategory: 'flat',
      type: 'rent',
      property_type: 'flat',
      price: 22000, // ₹22,000/mo
      deposit: 110000,
      currency: 'INR',
      address: 'East Sambandam Road, RS Puram',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641002',
      lat: 11.009800,
      lng: 76.949200,
      bedrooms: 2,
      bathrooms: 2,
      bhk: 2,
      area_sqft: 1200,
      year_built: 2021,
      furnishing: 'semi-furnished',
      parking_spaces: 1,
      amenities: ['Lift', 'Piped Gas', 'Covered Parking', '24/7 Water Supply', 'Security Guard', 'Balcony'],
      is_verified: 1,
      match_score: 91,
      trust_score: 90,
      life_score: 95,
      green_score: 80,
      hidden_costs: { reg: 0, stamp: 2000, maint: 24000, tax: 0, total: 26000 },
      images: [
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Ultra Luxury 3BHK Penthouse with Private Sky Deck',
      description: 'Penthouse overlooking the race course tree canopy. Features private terrace jacuzzi, VRV air conditioning, double height ceiling living room, and Italian designer lighting.',
      category: 'residential',
      subcategory: 'bungalow',
      type: 'lease',
      property_type: 'penthouse',
      price: 45000, // ₹45,000/mo
      deposit: 300000,
      currency: 'INR',
      address: 'Race Course Road',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641018',
      lat: 11.001600,
      lng: 76.974000,
      bedrooms: 3,
      bathrooms: 3.5,
      bhk: 3,
      area_sqft: 2400,
      year_built: 2023,
      furnishing: 'fully-furnished',
      parking_spaces: 2,
      amenities: ['Sky Deck Terrace', 'VRV Air Conditioning', 'Concierge Service', 'Private Jacuzzi', 'Infinity Pool', 'Gym', 'High Speed Elevators'],
      is_verified: 1,
      match_score: 97,
      trust_score: 96,
      life_score: 94,
      green_score: 88,
      hidden_costs: { reg: 0, stamp: 5000, maint: 48000, tax: 0, total: 53000 },
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1000&q=80'
      ]
    },

    // --- 2. LAND & PLOTS ---
    {
      owner_email: 'karthik@homesphere.com',
      title: 'DTCP & RERA Approved Residential Villa Plot (2,400 sq.ft)',
      description: 'Clear title freehold corner plot in a premium gated layout with 40ft tar road, underground drainage, street lighting, sweet ground water, and ready for immediate villa construction.',
      category: 'land_plots',
      subcategory: 'residential_plot',
      type: 'sale',
      property_type: 'residential_plot',
      price: 4800000, // ₹48 Lakhs
      deposit: 0,
      currency: 'INR',
      address: 'Near KMCH, Avinashi Road',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641014',
      lat: 11.042800,
      lng: 77.045600,
      bedrooms: 0,
      bathrooms: 0,
      bhk: 0,
      area_sqft: 2400,
      year_built: 2024,
      furnishing: 'unfurnished',
      parking_spaces: 0,
      amenities: ['DTCP Approved', 'RERA Registered', '40ft Tar Road', 'Underground Drainage', 'Street Lights', 'Compound Wall Gated', 'Avenue Trees'],
      is_verified: 1,
      match_score: 93,
      trust_score: 97,
      life_score: 87,
      green_score: 90,
      hidden_costs: { reg: 48000, stamp: 336000, maint: 6000, tax: 4000, total: 394000 },
      images: [
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Prime Highway Facing Commercial Plot (12,000 sq.ft)',
      description: 'High visibility commercial corner land with 100ft frontage on Trichy Road. Ideal for auto showroom, hospital, corporate headquarters, or commercial retail complex.',
      category: 'land_plots',
      subcategory: 'commercial_plot',
      type: 'sale',
      property_type: 'commercial_plot',
      price: 21000000, // ₹2.10 Cr
      deposit: 0,
      currency: 'INR',
      address: 'Main Trichy Road, Singanallur',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641005',
      lat: 11.002400,
      lng: 77.019500,
      bedrooms: 0,
      bathrooms: 0,
      bhk: 0,
      area_sqft: 12000,
      year_built: 2024,
      furnishing: 'unfurnished',
      parking_spaces: 10,
      amenities: ['National Highway Frontage', 'Commercial Zone Approved', 'Heavy Vehicle Access', 'High Density Traffic', '3-Phase EB Line'],
      is_verified: 1,
      match_score: 95,
      trust_score: 94,
      life_score: 90,
      green_score: 75,
      hidden_costs: { reg: 210000, stamp: 1470000, maint: 0, tax: 35000, total: 1715000 },
      images: [
        'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
      ]
    },

    // --- 3. COMMERCIAL ---
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Fully Furnished Grade-A IT Office Space (3,500 sq.ft)',
      description: 'Plug-and-play modern corporate office space in tech zone. Features 45 workstations, 2 executive cabins, 12-seater conference room with video conferencing, cafeteria, server room, and 100% DG backup.',
      category: 'commercial',
      subcategory: 'office',
      type: 'lease',
      property_type: 'office',
      price: 135000, // ₹1,35,000/mo
      deposit: 810000,
      currency: 'INR',
      address: 'Near TIDEL Park, Civil Aerodrome Post',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641014',
      lat: 11.031000,
      lng: 77.032000,
      bedrooms: 0,
      bathrooms: 4,
      bhk: 0,
      area_sqft: 3500,
      year_built: 2023,
      furnishing: 'fully-furnished',
      parking_spaces: 6,
      amenities: ['45 Workstations', 'Conference Room', '100% DG Power Backup', 'Central AC', 'High Speed Fiber', 'Cafeteria', 'Biometric Turnstiles', 'Fire Safety Sprinklers'],
      is_verified: 1,
      match_score: 95,
      trust_score: 96,
      life_score: 92,
      green_score: 85,
      hidden_costs: { reg: 0, stamp: 15000, maint: 42000, tax: 0, total: 57000 },
      images: [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'ananya@homesphere.com',
      title: 'Prime Retail Commercial Showroom with Glass Facade',
      description: 'Ground floor high-footfall retail shop located in the commercial heart of Gandhipuram. Ideal for apparel brand, jewelry showroom, electronics, or premium cafe.',
      category: 'commercial',
      subcategory: 'showroom',
      type: 'rent',
      property_type: 'showroom',
      price: 85000, // ₹85,000/mo
      deposit: 500000,
      currency: 'INR',
      address: 'Cross Cut Road, Gandhipuram',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641012',
      lat: 11.018500,
      lng: 76.967800,
      bedrooms: 0,
      bathrooms: 2,
      bhk: 0,
      area_sqft: 1800,
      year_built: 2022,
      furnishing: 'semi-furnished',
      parking_spaces: 3,
      amenities: ['Full Glass Frontage', 'Main Road Visibility', 'High Footfall Hub', 'Dedicated Customer Parking', '3-Phase 25KW EB', 'LED Display Provision'],
      is_verified: 1,
      match_score: 92,
      trust_score: 93,
      life_score: 95,
      green_score: 78,
      hidden_costs: { reg: 0, stamp: 10000, maint: 18000, tax: 0, total: 28000 },
      images: [
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1582037928769-181f2644ecb7?auto=format&fit=crop&w=1000&q=80'
      ]
    },

    // --- 4. PG & ROOMS ---
    {
      owner_email: 'karthik@homesphere.com',
      title: 'Executive Co-Living Single Room with AC & High-Speed WiFi',
      description: 'Modern luxury co-living studio room designed for IT professionals and corporate executives. Includes 3-times hygienic home-cooked meals, daily housekeeping, 300Mbps fiber internet, gym access, and laundry service.',
      category: 'pg_rooms',
      subcategory: 'single_room',
      type: 'rent',
      property_type: 'single_room',
      price: 9500, // ₹9,500/mo
      deposit: 20000,
      currency: 'INR',
      address: 'Hope College, Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.033000,
      lng: 77.012000,
      bedrooms: 1,
      bathrooms: 1,
      bhk: 1,
      area_sqft: 280,
      year_built: 2023,
      furnishing: 'fully-furnished',
      parking_spaces: 1,
      amenities: ['Air Conditioning', '3 Meals Included', '300Mbps WiFi', 'Attached Bathroom', 'Smart TV with OTT', 'Daily Housekeeping', 'Washing Machine', 'RO Water Purifier', 'CCTV Security'],
      is_verified: 1,
      match_score: 96,
      trust_score: 92,
      life_score: 93,
      green_score: 82,
      hidden_costs: { reg: 0, stamp: 0, maint: 0, tax: 0, total: 0 },
      images: [
        'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1540518614846-7ede433c4570?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'ananya@homesphere.com',
      title: 'Premium Shared Student PG near Tech Institutions',
      description: 'Comfortable twin-sharing room with individual study desks, ergonomic chairs, individual wardrobes, delicious South/North Indian food, and proximity to major colleges & IT parks.',
      category: 'pg_rooms',
      subcategory: 'shared_room',
      type: 'rent',
      property_type: 'shared_room',
      price: 6500, // ₹6,500/mo
      deposit: 15000,
      currency: 'INR',
      address: 'Near Kumaraguru College, Saravanampatti',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641035',
      lat: 11.081000,
      lng: 76.992000,
      bedrooms: 1,
      bathrooms: 1,
      bhk: 1,
      area_sqft: 350,
      year_built: 2022,
      furnishing: 'fully-furnished',
      parking_spaces: 1,
      amenities: ['Twin Sharing', 'Food Included', 'High Speed WiFi', 'Study Desks', 'Power Backup Generator', 'Water Geyser', 'Biometric Entry', 'Laundry Facility'],
      is_verified: 1,
      match_score: 93,
      trust_score: 91,
      life_score: 91,
      green_score: 80,
      hidden_costs: { reg: 0, stamp: 0, maint: 0, tax: 0, total: 0 },
      images: [
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&q=80'
      ]
    },

    // --- 5. NEW PROJECTS ---
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Emerald Palms Luxury Gated Community Villas (Pre-Launch)',
      description: 'Exclusive 18-acre township of 120 Spanish-style luxury villas with grand clubhouse, international sports court, infinity swimming pool, jogging track, and 70% open green space.',
      category: 'new_projects',
      subcategory: 'new_villas',
      type: 'sale',
      property_type: 'new_villas',
      price: 18500000, // ₹1.85 Cr
      deposit: 500000,
      currency: 'INR',
      address: 'Thondamuthur Road, Vadavalli',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641041',
      lat: 11.012500,
      lng: 76.892000,
      bedrooms: 4,
      bathrooms: 4,
      bhk: 4,
      area_sqft: 3400,
      year_built: 2025,
      furnishing: 'semi-furnished',
      parking_spaces: 2,
      amenities: ['18-Acre Gated Township', 'Grand 25,000 sqft Clubhouse', 'Infinity Pool', 'Tennis & Badminton Courts', '70% Open Landscaped Green', 'IGBC Gold Certified', 'EV Charging', '24/7 Security'],
      is_verified: 1,
      match_score: 98,
      trust_score: 97,
      life_score: 94,
      green_score: 95,
      hidden_costs: { reg: 185000, stamp: 1295000, maint: 60000, tax: 30000, total: 1570000 },
      images: [
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Skyline Azure 2BHK & 3BHK High-Rise Smart Residences',
      description: 'Tallest residential twin towers in Coimbatore featuring home automation, sky lounge on 24th floor, EV charging for every car bay, biometric elevators, and earthquake resistant structural design.',
      category: 'new_projects',
      subcategory: 'new_apartments',
      type: 'sale',
      property_type: 'new_apartments',
      price: 9200000, // ₹92 Lakhs
      deposit: 200000,
      currency: 'INR',
      address: 'Main Avinashi Road, Near Airport',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641014',
      lat: 11.038000,
      lng: 77.039000,
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 1820,
      year_built: 2025,
      furnishing: 'unfurnished',
      parking_spaces: 2,
      amenities: ['Sky Lounge at 24th Floor', 'Biometric Elevators', 'Full Home Automation', 'Olympic Length Pool', 'Squash Court', 'Multi-tier Security', 'Amphitheatre', 'Co-Working Lounge'],
      is_verified: 1,
      match_score: 95,
      trust_score: 95,
      life_score: 92,
      green_score: 90,
      hidden_costs: { reg: 92000, stamp: 644000, maint: 40000, tax: 15000, total: 791000 },
      images: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'ananya@homesphere.com',
      title: 'Comfortable 2BHK Apartment near PSG CAS',
      description: 'Well-maintained 2BHK apartment with covered parking, 24/7 water supply, modular kitchen, and easy walking distance to bus stop and shopping.',
      category: 'residential',
      subcategory: 'apartment',
      type: 'rent',
      property_type: 'apartment',
      price: 18500, // ₹18,500/mo
      deposit: 90000,
      currency: 'INR',
      address: 'Near PSG CAS, Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.024500,
      lng: 77.001000,
      bedrooms: 2,
      bathrooms: 2,
      bhk: 2,
      area_sqft: 1100,
      year_built: 2022,
      furnishing: 'semi-furnished',
      parking_spaces: 1,
      amenities: ['24/7 Water', 'Lift', 'Covered Parking', 'Security Guard', 'Power Backup', 'Balcony'],
      is_verified: 1,
      match_score: 93,
      trust_score: 92,
      life_score: 92,
      green_score: 84,
      hidden_costs: { reg: 0, stamp: 1500, maint: 18000, tax: 0, total: 19500 },
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'rajesh.agent@homesphere.com',
      title: 'Commercial Boutique Office Space for Long-Term Lease',
      description: 'Ideal office space located on main Avinashi road Peelamedu with glass frontage, reception area, manager cabin, air conditioning, and power backup.',
      category: 'commercial',
      subcategory: 'office',
      type: 'lease',
      property_type: 'office',
      price: 55000, // ₹55,000/mo
      deposit: 350000,
      currency: 'INR',
      address: 'Avinashi Road, Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.029000,
      lng: 77.005500,
      bedrooms: 0,
      bathrooms: 2,
      bhk: 0,
      area_sqft: 1500,
      year_built: 2023,
      furnishing: 'fully-furnished',
      parking_spaces: 3,
      amenities: ['Central Air Conditioning', 'Glass Frontage', '100% Power Backup', 'Reception Desk', 'Conference Room', 'High Speed Internet'],
      is_verified: 1,
      match_score: 95,
      trust_score: 94,
      life_score: 91,
      green_score: 83,
      hidden_costs: { reg: 0, stamp: 8000, maint: 24000, tax: 0, total: 32000 },
      images: [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    {
      owner_email: 'karthik@homesphere.com',
      title: 'Independent 3BHK Residential House for Sale',
      description: 'Spacious independent house with private car parking, terrace garden, borewell + Siruvani water, and peaceful neighborhood.',
      category: 'residential',
      subcategory: 'independent_house',
      type: 'sale',
      property_type: 'villa',
      price: 9800000, // ₹98 Lakhs
      deposit: 0,
      currency: 'INR',
      address: 'VKK Menon Road, Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.021500,
      lng: 76.998000,
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 2200,
      year_built: 2021,
      furnishing: 'semi-furnished',
      parking_spaces: 2,
      amenities: ['Siruvani Water Connection', 'Borewell', 'Terrace Garden', 'CCTV Camera', 'Rainwater Harvesting', 'Covered Car Porch'],
      is_verified: 1,
      match_score: 96,
      trust_score: 96,
      life_score: 94,
      green_score: 89,
      hidden_costs: { reg: 98000, stamp: 686000, maint: 12000, tax: 15000, total: 811000 },
      images: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80'
      ]
    }
  ];

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const ownerId = userIds[p.owner_email] || 1;

    const [propRes] = await pool.query(
      `INSERT INTO properties (
        owner_id, title, description, category, subcategory, type, property_type,
        price, deposit, currency, address, city, state, zip_code, lat, lng,
        bedrooms, bathrooms, bhk, area_sqft, year_built, furnishing, parking_spaces,
        amenities_json, is_verified, verification_status, match_score, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        ownerId, p.title, p.description, p.category, p.subcategory, p.type, p.property_type,
        p.price, p.deposit, p.currency, p.address, p.city, p.state, p.zip_code, p.lat, p.lng,
        p.bedrooms, p.bathrooms, p.bhk, p.area_sqft, p.year_built, p.furnishing, p.parking_spaces,
        JSON.stringify(p.amenities), p.is_verified, 'verified', p.match_score
      ]
    );

    const propId = propRes.insertId;

    // Seed Images
    for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
      await pool.query(
        `INSERT INTO property_images (property_id, image_url, is_primary, caption)
         VALUES (?, ?, ?, ?)`,
        [propId, p.images[imgIdx], imgIdx === 0 ? 1 : 0, `${p.title} - View ${imgIdx + 1}`]
      );
    }

    // Seed Trust Score
    await pool.query(
      `INSERT INTO trust_scores (property_id, score, verification_rating, document_completeness, price_sanity_score, seller_reputation_score, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        propId,
        p.trust_score,
        96,
        98,
        92,
        95,
        JSON.stringify({
          risk_level: 'Audited & Verified Listing',
          title_clarity: '100% Clear Freehold / Encumbrance-Free',
          owner_verification: 'Government ID & Municipal Tax Roll Cross-Check Passed',
          image_authenticity: 'Original Photography Verified (Zero Stock Duplicates)',
          price_sanity: 'Priced within 3% of Sub-Registrar Benchmark'
        })
      ]
    );

    // Seed LifeScore
    await pool.query(
      `INSERT INTO life_scores (property_id, score, transit_score, school_score, safety_score, amenities_score, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        propId,
        p.life_score,
        Math.min(100, p.life_score + 2),
        Math.min(100, p.life_score + 3),
        Math.min(100, p.life_score + 4),
        Math.min(100, p.life_score + 1),
        JSON.stringify({
          safety_index: 'Grade A+ (Police Patrolled & Low Incident Zone)',
          hospitals: 'Top Multi-speciality Hospital within 2.5 km',
          schools: 'CBSE / ICSE Top Schools within 3.0 km',
          transit: 'Metro Station / Highway junction within 1.5 km',
          shopping: 'Supermarkets, Malls & Restaurants within 1.0 km'
        })
      ]
    );

    // Seed Green Score
    await pool.query(
      `INSERT INTO green_scores (property_id, score, energy_rating, green_cover_pct, air_quality_index, water_conservation, solar_equipped, breakdown_json)
       VALUES (?, ?, 'A+', 42, 35, 1, 1, ?)`,
      [
        propId,
        p.green_score,
        JSON.stringify({ air_quality: 'Pristine (AQI 35)', solar_status: 'Active Rooftop Net Metering' })
      ]
    );

    // Seed Hidden Costs
    const hc = p.hidden_costs;
    await pool.query(
      `INSERT INTO hidden_costs (property_id, registration_cost, stamp_duty, brokerage_cost, maintenance_est_annual, property_tax_annual, total_est_first_year)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [propId, hc.reg, hc.stamp, hc.maint, hc.tax, hc.total]
    );

    // Seed Property DNA
    await pool.query(
      `INSERT INTO property_dna (property_id, age_years, legal_status, structural_notes, ownership_history_json)
       VALUES (?, ?, 'Clear Freehold Title', 'Reinforced Concrete Structure with Earthquake Resistance', ?)`,
      [
        propId,
        new Date().getFullYear() - p.year_built,
        JSON.stringify([
          { year: p.year_built, event: 'Construction Completed & Occupancy Certificate Issued', owner: 'Original Developer' },
          { year: p.year_built + 1, event: 'RERA Certification & Municipal Tax Roll Enrollment', owner: 'HomeSphere Verified Owner' }
        ])
      ]
    );

    // Seed Future Value
    await pool.query(
      `INSERT INTO future_value_predictions (property_id, years, predicted_value, growth_rate_annual, confidence_level, market_trend_notes)
       VALUES (?, 5, ?, 6.8, 'High (92%)', 'Prime infrastructure corridor with planned metro line extension and IT expansion.')`,
      [propId, p.price * 1.38]
    );

    // Seed Price History
    await pool.query(
      `INSERT INTO price_history (property_id, price, event_type, notes)
       VALUES (?, ?, 'listed', 'Initial Marketplace Listing on HomeSphere')`,
      [propId, p.price]
    );
  }

  console.log(` ✔ Seeded ${properties.length} rich marketplace properties with full decision intelligence.`);

  console.log('\n====================================================');
  console.log('🎉 HOMESPHERE MARKETPLACE SEED COMPLETE & READY!');
  console.log('====================================================\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌ Seed Failed:', err);
  process.exit(1);
});

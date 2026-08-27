-- ==========================================================
-- HomeSphere AI Real-Estate Decision Platform
-- Database Schema & Initial Seed Data
-- Compatible with MySQL 8.0+, MariaDB, XAMPP, phpMyAdmin
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `homesphere` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `homesphere`;

-- Disable foreign key checks for clean recreation
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `virtual_tour_images`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `rental_applications`;
DROP TABLE IF EXISTS `transaction_milestones`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `price_history`;
DROP TABLE IF EXISTS `admin_actions`;
DROP TABLE IF EXISTS `user_preferences`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `comparisons`;
DROP TABLE IF EXISTS `saved_properties`;
DROP TABLE IF EXISTS `future_value_predictions`;
DROP TABLE IF EXISTS `hidden_costs`;
DROP TABLE IF EXISTS `green_scores`;
DROP TABLE IF EXISTS `life_scores`;
DROP TABLE IF EXISTS `property_dna`;
DROP TABLE IF EXISTS `trust_scores`;
DROP TABLE IF EXISTS `property_documents`;
DROP TABLE IF EXISTS `property_images`;
DROP TABLE IF EXISTS `properties`;
DROP TABLE IF EXISTS `users`;

-- 1. Users Table (Unified single-account model: 'user' can buy, sell, rent & list; 'admin' for system management)
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin', 'buyer', 'seller') NOT NULL DEFAULT 'user',
  `phone` VARCHAR(30) DEFAULT NULL,
  `avatar_url` VARCHAR(255) DEFAULT '/images/users/default-avatar.png',
  `status` ENUM('active', 'banned', 'pending') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_email` (`email`),
  INDEX `idx_user_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Properties Table (with Virtual Tour & Transparency Metrics)
CREATE TABLE `properties` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `owner_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'residential',
  `subcategory` VARCHAR(100) NOT NULL DEFAULT 'apartment',
  `type` ENUM('buy', 'sale', 'rent', 'lease') NOT NULL DEFAULT 'buy',
  `property_type` VARCHAR(100) NOT NULL DEFAULT 'apartment',
  `price` DECIMAL(12,2) NOT NULL,
  `deposit` DECIMAL(12,2) DEFAULT 0.00,
  `currency` VARCHAR(10) DEFAULT 'INR',
  `lease_term` VARCHAR(50) DEFAULT '12 months',
  `address` VARCHAR(255) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `zip_code` VARCHAR(20) DEFAULT NULL,
  `lat` DECIMAL(10,8) DEFAULT 0.00000000,
  `lng` DECIMAL(11,8) DEFAULT 0.00000000,
  `bedrooms` INT NOT NULL DEFAULT 1,
  `bathrooms` DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  `bhk` INT NOT NULL DEFAULT 1,
  `area_sqft` INT NOT NULL,
  `year_built` INT NOT NULL DEFAULT 2020,
  `furnishing` ENUM('unfurnished', 'semi-furnished', 'fully-furnished') NOT NULL DEFAULT 'unfurnished',
  `parking_spaces` INT DEFAULT 1,
  `amenities_json` JSON DEFAULT NULL,
  `virtual_tour_url` VARCHAR(500) DEFAULT NULL,
  `virtual_tour_json` JSON DEFAULT NULL,
  `climate_risk_score` INT DEFAULT 15,
  `hoa_reserve_health_pct` INT DEFAULT 120,
  `is_verified` TINYINT(1) DEFAULT 1,
  `verification_status` ENUM('unverified', 'pending', 'verified') DEFAULT 'verified',
  `match_score` INT DEFAULT 90,
  `status` ENUM('pending', 'active', 'sold', 'rented', 'rejected') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_prop_city` (`city`),
  INDEX `idx_prop_price` (`price`),
  INDEX `idx_prop_type` (`type`),
  INDEX `idx_prop_lat_lng` (`lat`, `lng`),
  INDEX `idx_prop_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Property Images Table
CREATE TABLE `property_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `is_primary` TINYINT(1) DEFAULT 0,
  `caption` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  INDEX `idx_img_property` (`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Property Documents (Verification)
CREATE TABLE `property_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `doc_type` VARCHAR(100) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `verified_status` ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  `reviewed_by` INT DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_doc_status` (`verified_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Trust Scores (AI Trust Engine)
CREATE TABLE `trust_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL UNIQUE,
  `score` INT NOT NULL DEFAULT 50,
  `verification_rating` INT DEFAULT 50,
  `document_completeness` INT DEFAULT 50,
  `price_sanity_score` INT DEFAULT 50,
  `seller_reputation_score` INT DEFAULT 50,
  `breakdown_json` JSON DEFAULT NULL,
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Property DNA (Structured Fingerprint)
CREATE TABLE `property_dna` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL UNIQUE,
  `age_years` INT NOT NULL DEFAULT 0,
  `legal_status` VARCHAR(100) DEFAULT 'Clear Title Verified',
  `ownership_history_json` JSON DEFAULT NULL,
  `structural_notes` TEXT DEFAULT NULL,
  `renovation_history_json` JSON DEFAULT NULL,
  `flags_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. LifeScores (Livability Index)
CREATE TABLE `life_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL UNIQUE,
  `score` INT NOT NULL DEFAULT 75,
  `transit_score` INT DEFAULT 70,
  `school_score` INT DEFAULT 80,
  `safety_score` INT DEFAULT 85,
  `amenities_score` INT DEFAULT 75,
  `breakdown_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Green Living Scores (Sustainability Rating)
CREATE TABLE `green_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL UNIQUE,
  `score` INT NOT NULL DEFAULT 70,
  `energy_rating` VARCHAR(10) DEFAULT 'A',
  `green_cover_pct` INT DEFAULT 35,
  `air_quality_index` INT DEFAULT 45,
  `water_conservation` TINYINT(1) DEFAULT 1,
  `solar_equipped` TINYINT(1) DEFAULT 0,
  `breakdown_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Hidden Cost Analysis
CREATE TABLE `hidden_costs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL UNIQUE,
  `registration_cost` DECIMAL(12,2) DEFAULT 0.00,
  `stamp_duty` DECIMAL(12,2) DEFAULT 0.00,
  `brokerage_cost` DECIMAL(12,2) DEFAULT 0.00,
  `maintenance_est_annual` DECIMAL(12,2) DEFAULT 0.00,
  `property_tax_annual` DECIMAL(12,2) DEFAULT 0.00,
  `repair_contingency` DECIMAL(12,2) DEFAULT 0.00,
  `total_est_first_year` DECIMAL(12,2) DEFAULT 0.00,
  `breakdown_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Future Value Predictions
CREATE TABLE `future_value_predictions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `years` INT NOT NULL DEFAULT 5,
  `predicted_value` DECIMAL(12,2) NOT NULL,
  `growth_rate_annual` DECIMAL(5,2) NOT NULL DEFAULT 5.50,
  `confidence_level` VARCHAR(20) DEFAULT 'High (88%)',
  `market_trend_notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Saved Properties
CREATE TABLE `saved_properties` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `property_id` INT NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `saved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_property_save` (`user_id`, `property_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Comparisons
CREATE TABLE `comparisons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `property_ids_json` JSON NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Contacts & Inquiries
CREATE TABLE `contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `property_id` INT DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `inquiry_type` ENUM('general', 'tour', 'pricing', 'documents') DEFAULT 'general',
  `status` ENUM('new', 'in_progress', 'resolved', 'closed') DEFAULT 'new',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. User Preferences (AI Matching)
CREATE TABLE `user_preferences` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `budget_min` DECIMAL(12,2) DEFAULT 100000.00,
  `budget_max` DECIMAL(12,2) DEFAULT 1500000.00,
  `preferred_city` VARCHAR(100) DEFAULT 'Austin',
  `preferred_type` VARCHAR(50) DEFAULT 'apartment',
  `lifestyle_json` JSON DEFAULT NULL,
  `priority_weights_json` JSON DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Admin Actions Audit Log
CREATE TABLE `admin_actions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL,
  `action_type` VARCHAR(100) NOT NULL,
  `target_id` INT NOT NULL,
  `target_type` VARCHAR(50) NOT NULL DEFAULT 'property',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Price History Ledger (Transparency)
CREATE TABLE `price_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `event_type` ENUM('listed', 'price_reduction', 'price_increase', 'offer_pending', 'sold') NOT NULL DEFAULT 'listed',
  `notes` VARCHAR(255) DEFAULT NULL,
  `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  INDEX `idx_price_hist_prop` (`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Real Estate Transactions & Deal Pipeline
CREATE TABLE `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `buyer_id` INT NOT NULL,
  `seller_id` INT NOT NULL,
  `deal_type` ENUM('buy', 'rent') NOT NULL DEFAULT 'buy',
  `offer_amount` DECIMAL(12,2) NOT NULL,
  `deposit_amount` DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
  `current_stage` ENUM('interested', 'visit_scheduled', 'offer_submitted', 'offer_accepted', 'doc_verification', 'agreement_pending', 'completed') NOT NULL DEFAULT 'interested',
  `scheduled_visit_date` DATETIME DEFAULT NULL,
  `contingencies_json` JSON DEFAULT NULL,
  `proposed_closing_date` DATE DEFAULT NULL,
  `status` ENUM('active', 'completed', 'cancelled', 'rejected') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_tx_buyer` (`buyer_id`),
  INDEX `idx_tx_seller` (`seller_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Transaction Milestones
CREATE TABLE `transaction_milestones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` INT NOT NULL,
  `stage_name` VARCHAR(100) NOT NULL,
  `completed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT DEFAULT NULL,
  `document_url` VARCHAR(500) DEFAULT NULL,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Rental Fast-Track Applications
CREATE TABLE `rental_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `applicant_name` VARCHAR(100) NOT NULL,
  `applicant_email` VARCHAR(150) NOT NULL,
  `applicant_income_monthly` DECIMAL(10,2) NOT NULL,
  `credit_score_est` INT DEFAULT 720,
  `employment_status` VARCHAR(100) DEFAULT 'Employed Full-Time',
  `move_in_date` DATE NOT NULL,
  `occupants_count` INT DEFAULT 1,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. In-App Property Messages & Secure Chat
CREATE TABLE `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_msg_prop` (`property_id`),
  INDEX `idx_msg_sender` (`sender_id`),
  INDEX `idx_msg_receiver` (`receiver_id`),
  INDEX `idx_msg_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Real Uploaded Multi-Room Virtual Tour Walkthrough Images
CREATE TABLE `virtual_tour_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `property_id` INT NOT NULL,
  `room_name` VARCHAR(100) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `room_description` TEXT DEFAULT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_panoramic` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
  INDEX `idx_vt_prop` (`property_id`),
  INDEX `idx_vt_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================================
-- Database Schema Ready for Live User Data (Zero Dummy Seed Records)
-- All user activities, properties, transactions, and scores will originate from real user actions.
-- ==========================================================


-- Unified Users (Single Account Model: role = 'user' for normal members, 'admin' for administrators)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `phone`, `avatar_url`, `status`) VALUES
(1, 'Alex Mercer (Admin)', 'admin@homesphere.com', '$2a$10$pwQ3EO3XBvsPX.MrTW4NIuavT7GEaxWIdL3xKR9oAlGyt3d59PdYS', 'admin', '+1 (555) 019-2834', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 'active'),
(2, 'Sarah Jenkins (Member)', 'seller@homesphere.com', '$2a$10$pwQ3EO3XBvsPX.MrTW4NIuavT7GEaxWIdL3xKR9oAlGyt3d59PdYS', 'user', '+1 (555) 384-9201', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80', 'active'),
(3, 'David Vance (Member)', 'buyer@homesphere.com', '$2a$10$pwQ3EO3XBvsPX.MrTW4NIuavT7GEaxWIdL3xKR9oAlGyt3d59PdYS', 'user', '+1 (555) 782-1144', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 'active'),
(4, 'Alex Rivera (Universal Member)', 'demo@homesphere.com', '$2a$10$pwQ3EO3XBvsPX.MrTW4NIuavT7GEaxWIdL3xKR9oAlGyt3d59PdYS', 'user', '+1 (555) 234-5678', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80', 'active');

-- Properties
INSERT INTO `properties` (`id`, `owner_id`, `title`, `description`, `type`, `property_type`, `price`, `deposit`, `lease_term`, `address`, `city`, `state`, `zip_code`, `lat`, `lng`, `bedrooms`, `bathrooms`, `area_sqft`, `year_built`, `furnishing`, `parking_spaces`, `amenities_json`, `virtual_tour_url`, `virtual_tour_json`, `climate_risk_score`, `hoa_reserve_health_pct`, `status`) VALUES
(1, 2, 'The Lumina Glass Penthouse with Panoramic Skyline', 'An architectural masterpiece perched atop the luxury Zenith Tower. Featuring 14-ft floor-to-ceiling smart glass, private elevator access, Italian Poliform kitchen, and automated climate/lighting zones. Zero legal liabilities, 100% verified documentation.', 'buy', 'penthouse', 1850000.00, 0.00, 'N/A', '742 Skyview Boulevard, Suite PH-B', 'Austin', 'TX', '78701', 30.26715300, -97.74306080, 3, 3.5, 3420, 2022, 'fully-furnished', 2, '["Private Elevator", "Smart Glass", "Rooftop Terrace", "Concierge 24/7", "EV Charging", "Infinity Pool", "Wine Cellar"]', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80', '{"rooms": [{"name": "Living Room & Skyline", "image": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80", "description": "14-ft ceiling panoramic living hall with smart glass"}, {"name": "Chef Kitchen & Wine Cellar", "image": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80", "description": "Poliform Italian marble island with Gaggenau induction"}, {"name": "Master Skyline Suite", "image": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80", "description": "Acoustically decoupled bedroom facing downtown"}, {"name": "Infinity Sky Terrace", "image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80", "description": "Private heated plunge pool and lounge"}]}', 12, 140, 'active'),

(2, 2, 'Verdant Haven Modern Eco-Villa with Solar Array', 'Net-zero carbon emission villa equipped with Tesla solar roof, rainwater harvesting system, and triple-glazed acoustic windows. Surrounded by landscaped native flora in a gated community.', 'buy', 'villa', 1280000.00, 0.00, 'N/A', '1204 Pinecrest Trail', 'Seattle', 'WA', '98101', 47.60620950, -122.33207080, 4, 4.0, 4150, 2023, 'semi-furnished', 3, '["Solar Roof", "Rainwater Harvesting", "Smart Security", "Private Garden", "Heated Floors", "Home Theater"]', 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80', '{"rooms": [{"name": "Eco-Living Great Room", "image": "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80"}, {"name": "Sustainable Dining & Patio", "image": "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1600&q=80"}]}', 8, 130, 'active'),

(3, 4, 'The Grand Regency Heritage Townhouse', 'Historic brick facade combined with state-of-the-art contemporary interior renovation. High ceilings, exposed original beam work, chef-grade Wolf appliances, and private cobblestone courtyard.', 'buy', 'townhouse', 950000.00, 0.00, 'N/A', '45 Commonwealth Ave', 'Chicago', 'IL', '60614', 41.87811360, -87.62979820, 3, 2.5, 2800, 2018, 'semi-furnished', 1, '["Private Courtyard", "Fireplace", "High Ceilings", "Smart Lock", "Hardwood Floors", "Subway Proximity"]', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80', '{"rooms": [{"name": "Historic Great Hall", "image": "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80"}]}', 18, 115, 'active'),

(4, 2, 'Neo Loft Minimalist Waterfront Apartment', 'Chic open-concept industrial modern loft directly facing the bay. Polished concrete flooring, exposed ducts, bespoke brass fixtures, and access to private yacht docking pier.', 'rent', 'apartment', 4200.00, 8400.00, '12 months', '88 Marina Promenade, Apt 1208', 'Miami', 'FL', '33131', 25.76167980, -80.19179020, 2, 2.0, 1680, 2021, 'fully-furnished', 1, '["Waterfront View", "Gym & Spa", "Valet Parking", "24/7 Security", "Pet Friendly", "Balcony"]', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80', '{"rooms": [{"name": "Bayfront Loft Hall", "image": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80"}]}', 22, 125, 'active');

-- Property Images
INSERT INTO `property_images` (`property_id`, `image_url`, `is_primary`, `caption`) VALUES
(1, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', 1, 'Lumina Penthouse Living Room Skyline View'),
(1, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', 0, 'Designer Kitchen with Marble Island'),
(1, 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80', 0, 'Master Suite with Private Balcony'),
(1, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', 0, 'Infinity Pool and Terrace'),
(2, 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80', 1, 'Verdant Haven Eco-Villa Exterior & Solar Roof'),
(3, 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80', 1, 'Grand Regency Historic Brick Facade'),
(4, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 1, 'Waterfront Loft Main Living Area');

-- Property Documents
INSERT INTO `property_documents` (`property_id`, `doc_type`, `file_url`, `verified_status`, `notes`) VALUES
(1, 'Title Deed', '/documents/sample-title-deed.pdf', 'verified', '100% verified freehold with Austin municipal records cross-checked.'),
(1, 'Property Tax Clearance', '/documents/tax-clearance.pdf', 'verified', 'Zero outstanding municipal tax liabilities.'),
(2, 'Solar Grid Interconnect Certificate', '/documents/solar-cert.pdf', 'verified', 'Utility net metering agreement active.'),
(3, 'Historical Registry Certificate', '/documents/historic-registry.pdf', 'verified', 'State Historical Landmark verified.'),
(4, 'HOA By-Laws & Reserve Audit', '/documents/hoa-audit.pdf', 'verified', '125% HOA reserve funding ratio confirmed.');

-- Price History
INSERT INTO `price_history` (`property_id`, `price`, `event_type`, `notes`, `recorded_at`) VALUES
(1, 1950000.00, 'listed', 'Original initial listing price', '2025-11-10 10:00:00'),
(1, 1850000.00, 'price_reduction', 'Optimized to competitive market benchmark', '2026-01-15 14:30:00'),
(2, 1280000.00, 'listed', 'Eco-villa market debut', '2026-02-01 09:00:00'),
(3, 980000.00, 'listed', 'Heritage listing launch', '2025-12-05 11:00:00'),
(3, 950000.00, 'price_reduction', 'Renovation completion promotional pricing', '2026-01-20 16:00:00');

-- Active Transactions
INSERT INTO `transactions` (`id`, `property_id`, `buyer_id`, `seller_id`, `deal_type`, `offer_amount`, `deposit_amount`, `current_stage`, `scheduled_visit_date`, `contingencies_json`, `proposed_closing_date`, `status`) VALUES
(1, 1, 3, 2, 'buy', 1820000.00, 50000.00, 'doc_verification', '2026-08-22 10:00:00', '{"financing_contingency": true, "inspection_contingency": true, "appraisal_contingency": true, "title_search_clearance": true}', '2026-09-30', 'active'),
(2, 2, 3, 2, 'buy', 1260000.00, 30000.00, 'visit_scheduled', '2026-08-28 14:00:00', '{"inspection_contingency": true, "solar_meter_audit": true}', '2026-10-15', 'active'),
(3, 4, 3, 2, 'rent', 4200.00, 8400.00, 'offer_accepted', '2026-08-24 16:30:00', '{"credit_check_passed": true, "background_verified": true}', '2026-09-01', 'active');

-- Transaction Milestones
INSERT INTO `transaction_milestones` (`transaction_id`, `stage_name`, `notes`, `completed_at`) VALUES
(1, 'Interested', 'Buyer registered high interest and reviewed Property DNA and Trust Score.', '2026-08-18 10:00:00'),
(1, 'Visit Scheduled', 'On-site VIP walkthrough completed with listing agent.', '2026-08-19 14:00:00'),
(1, 'Offer Submitted', 'Buyer submitted digital purchase offer of $1,820,000.', '2026-08-20 09:15:00'),
(1, 'Offer Accepted', 'Seller accepted offer terms. Escrow instructions dispatched.', '2026-08-21 14:20:00'),
(1, 'Document Verification', 'Title deed, municipal tax receipts, and HOA reserves verified clean.', '2026-08-23 16:45:00'),
(2, 'Interested', 'Buyer saved property and requested personalized energy savings audit.', '2026-08-22 11:00:00'),
(2, 'Visit Scheduled', 'Private solar villa walkthrough scheduled for Aug 28, 2026 at 2:00 PM.', '2026-08-23 15:30:00'),
(3, 'Interested', 'Renter viewed 360 Virtual Tour and expressed rental interest.', '2026-08-21 09:00:00'),
(3, 'Visit Scheduled', 'Virtual live agent walkthrough completed.', '2026-08-22 11:00:00'),
(3, 'Offer Submitted', 'Renter submitted lease application with 2-month security deposit.', '2026-08-23 12:00:00'),
(3, 'Offer Accepted', 'Landlord accepted application. Digital lease agreement generation pending.', '2026-08-24 10:00:00');

-- Rental Applications
INSERT INTO `rental_applications` (`id`, `property_id`, `user_id`, `applicant_name`, `applicant_email`, `applicant_income_monthly`, `credit_score_est`, `employment_status`, `move_in_date`, `occupants_count`, `status`, `notes`) VALUES
(1, 4, 3, 'David Vance', 'buyer@homesphere.com', 14500.00, 785, 'Senior Software Engineer', '2026-09-01', 2, 'approved', 'Applicant profile verified with strong credit and proof of income.');

-- Trust Scores
INSERT INTO `trust_scores` (`property_id`, `score`, `verification_rating`, `document_completeness`, `price_sanity_score`, `seller_reputation_score`, `breakdown_json`) VALUES
(1, 96, 98, 100, 92, 95, '{"document_verification": 100, "registry_cross_check": 98, "pricing_benchmark": 92, "seller_history": 95, "title_clarity": "Flawless Freehold", "risk_level": "Extremely Low"}'),
(2, 94, 95, 95, 90, 96, '{"document_verification": 95, "registry_cross_check": 95, "pricing_benchmark": 90, "seller_history": 96, "title_clarity": "Clear Freehold", "risk_level": "Extremely Low"}'),
(3, 89, 90, 90, 85, 92, '{"document_verification": 90, "registry_cross_check": 90, "pricing_benchmark": 85, "seller_history": 92, "title_clarity": "Historical Verified", "risk_level": "Low"}'),
(4, 91, 92, 90, 90, 92, '{"document_verification": 92, "registry_cross_check": 90, "pricing_benchmark": 90, "seller_history": 92, "title_clarity": "Verified Leasehold", "risk_level": "Low"}');

-- Property DNA
INSERT INTO `property_dna` (`property_id`, `age_years`, `legal_status`, `ownership_history_json`, `structural_notes`, `renovation_history_json`, `flags_json`) VALUES
(1, 2, '100% Clear Title (Freehold)', '[{"year": 2022, "event": "Completed by Zenith Architectural Group", "owner": "Original Developer"}, {"year": 2023, "event": "Acquired by Current Owner", "owner": "Sarah Jenkins"}]', 'Reinforced steel and post-tensioned concrete structure. Seismic Grade 4 certification. Acoustically decoupled flooring.', '[{"year": 2023, "description": "Custom Poliform Italian kitchen & wine cellar installation"}]', '{"red_flags": [], "green_flags": ["No pending legal disputes", "Zero lien filings in 30-year audit", "HOA reserve fund is 140% funded"]}'),
(2, 1, 'Clear Title (Solar Interconnected)', '[{"year": 2023, "event": "Custom construction completed", "owner": "Sarah Jenkins"}]', 'Heavy timber and insulated concrete form (ICF) construction. R-40 thermal roof insulation.', '[{"year": 2024, "description": "Tesla Powerwall 3 integration and smart irrigation installation"}]', '{"red_flags": [], "green_flags": ["Net-zero energy certified", "Built-in seismic dampeners", "10-year builder structural warranty active"]}'),
(3, 6, 'Historic Registered Clear Title', '[{"year": 2018, "event": "Total gut renovation and historical restoration", "owner": "Elena Rostova"}]', 'Reinforced load-bearing masonry with modern steel interior frame.', '[{"year": 2022, "description": "HVAC dual-zone heat pump upgrade"}]', '{"red_flags": [], "green_flags": ["Historic landmark tax credits available", "Full electrical and copper plumbing replaced 2018"]}'),
(4, 3, 'Clear Condominium Title', '[{"year": 2021, "event": "Building completion", "owner": "Sarah Jenkins"}]', 'Marine-grade reinforced concrete. Impact resistant Category 5 hurricane glazing.', '[{"year": 2023, "description": "Custom hardwood cabinetry and smart shades"}]', '{"red_flags": [], "green_flags": ["Milestone structural inspection passed", "Full flood barrier installation"]}');

-- LifeScores
INSERT INTO `life_scores` (`property_id`, `score`, `transit_score`, `school_score`, `safety_score`, `amenities_score`, `breakdown_json`) VALUES
(1, 93, 91, 88, 96, 97, '{"walkability": 95, "transit_convenience": 91, "school_rating": 88, "neighborhood_safety": 96, "cafes_restaurants": 98, "groceries": 94, "healthcare_proximity_min": 6}'),
(2, 91, 84, 95, 94, 91, '{"walkability": 82, "transit_convenience": 84, "school_rating": 95, "neighborhood_safety": 94, "cafes_restaurants": 88, "groceries": 90, "healthcare_proximity_min": 8}'),
(3, 94, 96, 91, 92, 97, '{"walkability": 98, "transit_convenience": 96, "school_rating": 91, "neighborhood_safety": 92, "cafes_restaurants": 99, "groceries": 96, "healthcare_proximity_min": 4}'),
(4, 88, 85, 82, 91, 94, '{"walkability": 89, "transit_convenience": 85, "school_rating": 82, "neighborhood_safety": 91, "cafes_restaurants": 95, "groceries": 88, "healthcare_proximity_min": 7}');

-- Green Living Scores
INSERT INTO `green_scores` (`property_id`, `score`, `energy_rating`, `green_cover_pct`, `air_quality_index`, `water_conservation`, `solar_equipped`, `breakdown_json`) VALUES
(1, 91, 'A+', 42, 38, 1, 1, '{"energy_efficiency_kwh_sqft": 4.8, "solar_offset_pct": 35, "ev_stations": 6, "smart_thermostats": true, "waste_recycling_pct": 85}'),
(2, 98, 'A++', 65, 25, 1, 1, '{"energy_efficiency_kwh_sqft": 1.2, "solar_offset_pct": 105, "ev_stations": 2, "smart_thermostats": true, "waste_recycling_pct": 95, "rainwater_capacity_gal": 3000}'),
(3, 84, 'A', 35, 42, 1, 0, '{"energy_efficiency_kwh_sqft": 6.5, "solar_offset_pct": 0, "ev_stations": 1, "smart_thermostats": true, "waste_recycling_pct": 78}'),
(4, 87, 'A', 38, 30, 1, 0, '{"energy_efficiency_kwh_sqft": 5.9, "solar_offset_pct": 15, "ev_stations": 4, "smart_thermostats": true, "waste_recycling_pct": 80}');

-- Hidden Costs
INSERT INTO `hidden_costs` (`property_id`, `registration_cost`, `stamp_duty`, `brokerage_cost`, `maintenance_est_annual`, `property_tax_annual`, `repair_contingency`, `total_est_first_year`, `breakdown_json`) VALUES
(1, 18500.00, 92500.00, 37000.00, 14400.00, 31450.00, 5000.00, 198850.00, '{"closing_costs_pct": 8.0, "hoa_monthly": 1200.00, "estimated_insurance_annual": 4800.00, "title_insurance": 3200.00, "attorney_fee": 2500.00}'),
(2, 12800.00, 64000.00, 25600.00, 4800.00, 19200.00, 3500.00, 129900.00, '{"closing_costs_pct": 7.5, "hoa_monthly": 200.00, "estimated_insurance_annual": 3200.00, "title_insurance": 2400.00, "attorney_fee": 2000.00}'),
(3, 9500.00, 47500.00, 19000.00, 6000.00, 17100.00, 6000.00, 105100.00, '{"closing_costs_pct": 8.2, "hoa_monthly": 350.00, "estimated_insurance_annual": 2800.00, "title_insurance": 1900.00, "attorney_fee": 1800.00}'),
(4, 0.00, 0.00, 2100.00, 0.00, 0.00, 500.00, 11000.00, '{"move_in_deposit": 8400.00, "hoa_move_in_fee": 500.00, "broker_fee": 2100.00, "renters_insurance_annual": 400.00}');

-- Future Value Predictions
INSERT INTO `future_value_predictions` (`property_id`, `years`, `predicted_value`, `growth_rate_annual`, `confidence_level`, `market_trend_notes`) VALUES
(1, 5, 2475000.00, 6.00, 'High (91%)', 'Austin downtown core demonstrates continuous 5.8-6.4% CAGR fueled by ongoing enterprise tech relocations.'),
(1, 10, 3312000.00, 6.00, 'High (86%)', '10-year compounding index for Austin metropolitan corridor.'),
(2, 5, 1720000.00, 6.10, 'High (89%)', 'Net-zero eco-housing command 15-20% higher resale premiums.'),
(2, 10, 2310000.00, 6.10, 'High (84%)', '10-year sustainable housing appreciation benchmark.');

-- User Preferences
INSERT INTO `user_preferences` (`user_id`, `budget_min`, `budget_max`, `preferred_city`, `preferred_type`, `lifestyle_json`, `priority_weights_json`) VALUES
(3, 500000.00, 2000000.00, 'Austin', 'apartment', '{"prioritize_green": true, "near_transit": true, "top_schools": true, "luxury_amenities": true}', '{"trust": 0.35, "green": 0.25, "life": 0.25, "price": 0.15}'),
(4, 300000.00, 1500000.00, 'Seattle', 'villa', '{"prioritize_green": true, "near_transit": true, "top_schools": true}', '{"trust": 0.40, "green": 0.30, "life": 0.20, "price": 0.10}');

-- Saved Properties
INSERT INTO `saved_properties` (`user_id`, `property_id`, `notes`) VALUES
(3, 1, 'Top contender penthouse, love the panoramic view and 96 trust score'),
(3, 2, 'Great eco-friendly villa in Seattle');

-- In-App Property Messages
INSERT INTO `messages` (`id`, `property_id`, `sender_id`, `receiver_id`, `message`, `is_read`, `created_at`) VALUES
(1, 1, 3, 2, 'Hello Sarah! I reviewed the 360 virtual tour for The Lumina Glass Penthouse. Is the price negotiable if we proceed with a quick closing?', 1, '2026-08-22 10:15:00'),
(2, 1, 2, 3, 'Hi David! Yes, reasonable offers are welcome. We have clean title deed clearance ready for immediate escrow.', 1, '2026-08-22 10:28:00'),
(3, 1, 3, 2, 'That sounds great! Can I schedule an in-person walkthrough this Saturday afternoon?', 0, '2026-08-23 14:05:00'),
(4, 2, 3, 2, 'Hi Sarah, does the Meridian Eco-Villa include the solar battery backup in the sale price?', 1, '2026-08-23 11:30:00'),
(5, 2, 2, 3, 'Yes! The entire 15kW solar array and dual Tesla Powerwall systems are fully owned and included.', 0, '2026-08-23 12:10:00'),
(6, 4, 3, 2, 'Hi, I submitted a fast-track rental application for the Highland Arts Loft. Are pets allowed?', 1, '2026-08-24 09:00:00'),
(7, 4, 2, 3, 'Hello! Yes, small pets up to 35 lbs are welcome with a refundable $300 pet deposit.', 0, '2026-08-24 09:25:00');

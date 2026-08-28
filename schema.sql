-- DATABASE SCHEMA

-- Create the database if it doesn't already exist, and switch to it.
-- utf8mb4 is the character set that supports emoji/all unicode — good default.
CREATE DATABASE IF NOT EXISTS image_service
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE image_service;

-- USERS TABLE

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IMAGES TABLE
CREATE TABLE IF NOT EXISTS images (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  s3_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  width INT,
  height INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_images_user_id (user_id)
);
-- TRANSFORMATIONS TABLE

CREATE TABLE IF NOT EXISTS transformations (
  id VARCHAR(36) PRIMARY KEY,
  image_id VARCHAR(36) NOT NULL,
  cache_key VARCHAR(64) NOT NULL,
  s3_key VARCHAR(512) NOT NULL,
  format VARCHAR(20) NOT NULL,
  params JSON NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_image_cachekey (image_id, cache_key),

  INDEX idx_transformations_image_id (image_id)
);

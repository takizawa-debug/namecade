-- NameCard Database Schema
-- Applied via: npm run db:execute

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  phone_mobile TEXT,
  fax TEXT,
  address TEXT,
  postal_code TEXT,
  prefecture TEXT,
  city TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  website TEXT,
  sns_x TEXT,
  sns_facebook TEXT,
  sns_instagram TEXT,
  sns_linkedin TEXT,
  sns_other TEXT,
  name_romaji TEXT,
  exchanger TEXT,
  business_category TEXT,
  tags TEXT,
  memo TEXT,
  image_url TEXT,
  ai_analysis TEXT,
  drive_file_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'completed' | 'error'
  customer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS file_locks (
  file_id TEXT PRIMARY KEY,
  locked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

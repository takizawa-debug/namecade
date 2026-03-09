DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  segment TEXT,
  memo TEXT,
  image_url TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

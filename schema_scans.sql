CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'error'
  customer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

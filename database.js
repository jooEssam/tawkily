const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './database/tokili.db';
const resolvedPath = path.resolve(__dirname, DB_PATH);
const dbDir = path.dirname(resolvedPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(resolvedPath, (err) => {
  if (err) { console.error('DB Error:', err.message); }
  else { console.log('DB connected:', resolvedPath); initTables(); }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'lawyer' CHECK(role IN ('admin','lawyer')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS power_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS power_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS powers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      archive_number TEXT UNIQUE NOT NULL,
      type_id INTEGER,
      category_id INTEGER,
      category TEXT DEFAULT 'حفظ' CHECK(category IN ('حفظ','متداول')),
      status TEXT DEFAULT 'متاح' CHECK(status IN ('متاح','مع زميل')),
      location_id INTEGER,
      location TEXT,
      pdf_file TEXT,
      last_user_id INTEGER,
      last_used_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (type_id) REFERENCES power_types(id),
      FOREIGN KEY (category_id) REFERENCES power_categories(id),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (last_user_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS power_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      power_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('سحب','إرجاع')),
      checkout_at DATETIME,
      return_at DATETIME,
      days_held INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (power_id) REFERENCES powers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      sound_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      power_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      sent_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (power_id) REFERENCES powers(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (sent_by) REFERENCES users(id)
    )`);

    db.get("SELECT id FROM users WHERE role='admin' LIMIT 1", [], (err, row) => {
      if (!row) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
          ['مدير النظام', 'admin@tokili.com', hash, 'admin', 'active']);
        console.log('Default admin: admin@tokili.com / admin123');
      }
    });

    ['بيع','شراء','إدارة','قضايا','شركات','وراثة','رهن','وصية','تأجير'].forEach(t => {
      db.run(`INSERT OR IGNORE INTO power_types (name) VALUES (?)`, [t]);
    });

    ['حفظ','متداول'].forEach(c => {
      db.run(`INSERT OR IGNORE INTO power_categories (name) VALUES (?)`, [c]);
    });

    ['دولاب 1 - درج 1','دولاب 1 - درج 2','دولاب 2 - درج 1','دولاب 2 - درج 2','دولاب 3 - درج 1'].forEach(l => {
      db.run(`INSERT OR IGNORE INTO locations (name) VALUES (?)`, [l]);
    });

    console.log('Tables initialized.');
  });
}

module.exports = db;

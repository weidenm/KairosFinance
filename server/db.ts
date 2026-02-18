import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'kairos.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        date TEXT,
        description TEXT,
        amount REAL,
        category TEXT,
        type TEXT,
        source_file TEXT,
        original_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS ai_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT,
        content TEXT,
        type TEXT, -- 'consumption' or 'tip'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Migration for existing databases
try {
    db.exec(`ALTER TABLE transactions ADD COLUMN source_file TEXT;`);
} catch (e) {
    // Column might already exist
}
try {
    db.exec(`ALTER TABLE transactions ADD COLUMN original_date TEXT;`);
} catch (e) {
    // Column might already exist
}

// Seed default categories if empty
const count = db.prepare('SELECT count(*) as count FROM categories').get() as { count: number };
if (count.count === 0) {
    const insert = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const defaultCategories = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Compras', 'Outros'];
    defaultCategories.forEach(cat => insert.run(cat));
}

export default db;

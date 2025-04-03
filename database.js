const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./oylama.db', err => {
    if (err) console.error('Veritabanı bağlantı hatası:', err.message);
    else console.log('✅ Veritabanı bağlandı.');
});

// **Tabloları oluştur**
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS oylamalar (
        guild_id TEXT PRIMARY KEY,
        message_id TEXT,
        channel_id TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS adaylar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        name TEXT,
        emoji TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS fake_kullanicilar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        user_id TEXT,
        reason TEXT
    )`);
});

module.exports = db;

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "database.db");

// Función: resetear base de datos
function resetDatabase(callback) {
try {
    // 1. Eliminar archivo existente (si lo hay)
    if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("🗑️ Base de datos eliminada.");
    }

    // 2. Crear nueva conexión (crea archivo vacío automáticamente)
    const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error creando nueva BD:", err.message);
        if (callback) callback(err);
        return;
    }
    console.log("📦 Nueva base de datos creada.");

      // 3. Ejecutar esquema
    db.serialize(() => {
        db.run(
        `
            CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            correo TEXT NOT NULL UNIQUE,
            jugo INTEGER NOT NULL DEFAULT 0
            )
        `,
        (err2) => {
            if (err2) {
            console.error("❌ Error creando tabla:", err2.message);
            if (callback) callback(err2);
            } else {
            console.log("✅ Tabla 'usuarios' creada desde cero.");
            if (callback) callback(null, db);
            }
        }
        );
    });
    });
} catch (e) {
    console.error("❌ Error reseteando BD:", e.message);
    if (callback) callback(e);
}
}

module.exports = { resetDatabase };

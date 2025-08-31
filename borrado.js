const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "database.db");

// Función: resetear base de datos (RESET SUAVE, sin borrar archivo)
function resetDatabase(callback) {
  try {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("❌ Error abriendo BD para reset suave:", err.message);
        if (callback) callback(err);
        return;
      }
      // Evita "database is locked" esperando un poco si hay uso concurrente
      db.configure("busyTimeout", 3000);

      const schema = `
        BEGIN IMMEDIATE;
        DROP TABLE IF EXISTS usuarios;
        CREATE TABLE usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          correo TEXT NOT NULL UNIQUE,
          jugo INTEGER NOT NULL DEFAULT 0
        );
        DELETE FROM sqlite_sequence WHERE name='usuarios';
        COMMIT;
      `;

      db.exec(schema, (e) => {
        if (e) {
          console.error("❌ Error en reset suave:", e.message);
          // Intenta deshacer si algo quedó abierto
          db.exec("ROLLBACK;", () => {
            db.close(() => {
              if (callback) callback(e);
            });
          });
          return;
        }

        console.log("🔄 Reset suave completado. Tabla 'usuarios' lista.");
        // Cerramos esta conexión auxiliar para no dejar el archivo bloqueado
        db.close(() => {
          if (callback) callback(null);
        });
      });
    });
  } catch (e) {
    console.error("❌ Error reseteando BD (suave):", e.message);
    if (callback) callback(e);
  }
}

module.exports = { resetDatabase };

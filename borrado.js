const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "database.db");

// 🔐 Clave fija solicitada
const RESETDB_KEY = "2303josh";

/**
 * Reset suave de la BD dentro de una transacción.
 * - Uso recomendado: resetDatabase(key, callback)
 * - Retrocompatible:  resetDatabase(callback) -> devuelve error "Falta clave"
 */
function resetDatabase(keyOrCb, maybeCb) {
  let key, callback;

  if (typeof keyOrCb === "function") {
    // Llamada legacy: resetDatabase(callback)
    callback = keyOrCb;
    key = undefined; // obligamos a pasar clave
  } else {
    key = (keyOrCb ?? "").toString().trim();
    callback = maybeCb;
  }

  try {
    // 1) Validación de clave
    if (!key) {
      const err = new Error("Falta clave.");
      err.httpStatus = 401;
      if (callback) callback(err);
      return;
    }
    if (key !== RESETDB_KEY) {
      const err = new Error("Clave inválida.");
      err.httpStatus = 401;
      if (callback) callback(err);
      return;
    }

    // 2) Operación de reset suave (idéntica a tu lógica original)
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("❌ Error abriendo BD para reset suave:", err.message);
        if (callback) callback(err);
        return;
      }
      // Evita "database is locked" si hay uso concurrente
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

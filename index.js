const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Para recibir JSON en /certificado
app.use(express.static(path.join(__dirname, "public")));

// Helper: normalizar correo
function normalizarCorreo(c) {
  return String(c || "").trim().toLowerCase();
}

// Base de datos SQLite
const dbPath = path.join(__dirname, "database.db");
console.log("🗃️ DB path:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error al conectar con SQLite:", err.message);
  } else {
    console.log("📦 Base de datos conectada.");
  }
});

// === Esquema y migración SERIALIZADOS ===
db.serialize(() => {
  // Crear tabla si no existe (incluye jugo)
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      jugo INTEGER NOT NULL DEFAULT 0 -- 0=no, 1=si (certificado emitido)
    )
  `);

  // Migración suave: añade 'jugo' si no existiera por tablas antiguas
  db.all("PRAGMA table_info(usuarios);", (err, cols) => {
    if (err) {
      console.error("❌ Error leyendo esquema:", err.message);
      return;
    }
    const hasJugo = cols.some((c) => c.name === "jugo");
    if (!hasJugo) {
      db.run(
        "ALTER TABLE usuarios ADD COLUMN jugo INTEGER NOT NULL DEFAULT 0;",
        (err2) => {
          if (err2) {
            console.error("❌ Error agregando columna 'jugo':", err2.message);
          } else {
            console.log("🧩 Columna 'jugo' agregada con éxito.");
          }
        }
      );
    }
  });
});

// Ruta para registrar usuario
app.post("/registrar", (req, res) => {
  console.log("LLEGÓ UN POST /registrar ...");

  const nombre = String(req.body.nombre || "").trim();
  const correo = normalizarCorreo(req.body.correo);

  if (!nombre || nombre.length < 2 || !/@est\.una\.ac\.cr$/.test(correo)) {
    return res
      .status(400)
      .send("⚠️ Datos inválidos. Revisá tu nombre y correo.");
  }

  db.get(
    "SELECT id, nombre, correo, jugo FROM usuarios WHERE correo = ?",
    [correo],
    (err, row) => {
      if (err) return res.status(500).send("Error en la base de datos");

      // Si ya existe y ya jugó/emitió certificado, bloquear reinicio
      if (row && row.jugo === 1) {
        return res
          .status(403)
          .send(
            "⛔ Ya completaste el juego y tu certificado fue emitido. No podés reiniciar."
          );
      }

      // Si ya existe pero NO ha jugado/emitido certificado, permitir continuar
      if (row && row.jugo === 0) {
        return res.send("🔁 Ya estás registrado. Podés continuar el juego.");
      }

      // Crear nuevo registro con jugo = 0 (no jugado)
      db.run(
        "INSERT INTO usuarios (nombre, correo, jugo) VALUES (?, ?, 0)",
        [nombre, correo],
        (err2) => {
          if (err2) return res.status(500).send("Error al registrar");
          res.send("✅ Registro exitoso. ¡Bienvenido!");
        }
      );
    }
  );
});

// Ruta para marcar certificado emitido (actualiza jugo=1)
app.post("/certificado", (req, res) => {
  const correo = normalizarCorreo(req.body.correo);
  console.log("llega esto:", correo);

  if (!/@est\.una\.ac\.cr$/.test(correo)) {
    return res.status(400).send("⚠️ Correo inválido.");
  }

  db.get(
    "SELECT id, nombre, correo, jugo FROM usuarios WHERE correo = ?",
    [correo],
    (err, row) => {
      if (err) return res.status(500).send("Error en la base de datos");
      if (!row) {
        return res.status(404).send("❓ No existe un registro con ese correo.");
      }

      if (row.jugo === 1) {
        return res.send("🎓 El certificado ya había sido emitido anteriormente.");
      }

      // 🔎 Ver cuántos ya tienen certificado emitido (jugo=1)
      db.get("SELECT COUNT(*) as total FROM usuarios WHERE jugo = 1", (err2, countRow) => {
        if (err2) return res.status(500).send("Error en la base de datos al contar certificados");

        if (countRow.total >= 4) {
          return res.status(403).send("⛔ El límite de 4 certificados ya fue alcanzado.");
        }

        // ✅ Si todavía hay espacio, actualizar este usuario
        db.run(
          "UPDATE usuarios SET jugo = 1 WHERE correo = ?",
          [correo],
          function (err3) {
            if (err3) return res.status(500).send("Error al actualizar certificado");
            if (this.changes === 0) {
              return res
                .status(409)
                .send("⚠️ No se actualizó ningún registro (verificá el correo).");
            }

            db.get(
              "SELECT id, nombre, correo, jugo FROM usuarios WHERE correo = ?",
              [correo],
              (e3, rowAct) => {
                if (e3)
                  return res
                    .status(500)
                    .send("Actualizado, pero no se pudo leer el registro.");
                res.json({
                  mensaje: "🎉 Certificado emitido y bloqueo de reinicio activado.",
                  usuario: rowAct,
                });
              }
            );
          }
        );
      });
    }
  );
});


// Ruta para consultar usuarios (opcional)
app.get("/usuarios", (req, res) => {
  db.all(
    "SELECT id, nombre, correo, jugo FROM usuarios ORDER BY id DESC",
    (err, rows) => {
      if (err) return res.status(500).send("Error al obtener usuarios");
      res.json(rows);
    }
  );
});

// Ruta para servir index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});

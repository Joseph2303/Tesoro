const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const { resetDatabase } = require("./resetDb");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function normalizarCorreo(c) {
  return String(c || "")
    .trim()
    .toLowerCase();
}

const dbPath = path.join(__dirname, "database.db");
console.log("🗃️ DB path:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error al conectar con SQLite:", err.message);
  } else {
    console.log("📦 Base de datos conectada.");
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      jugo INTEGER NOT NULL DEFAULT 0 -- 0=no, 1=si (certificado emitido)
    )
  `);

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

      if (row && row.jugo === 1) {
        return res
          .status(403)
          .send(
            "⛔ Ya completaste el juego y tu certificado fue emitido. No podés reiniciar."
          );
      }

      if (row && row.jugo === 0) {
        return res.send("🔁 Ya estás registrado. Podés continuar el juego.");
      }

      db.get(
        "SELECT COUNT(*) AS total FROM usuarios WHERE jugo = 1",
        (err2, countRow) => {
          if (err2)
            return res
              .status(500)
              .send("Error en la base de datos al verificar cupos");

          if (countRow.total >= 4) {
            return res
              .status(403)
              .send(
                "⛔ Cupo cerrado: ya se emitieron 4 certificados, no se aceptan más registros."
              );
          }

          db.run(
            "INSERT INTO usuarios (nombre, correo, jugo) VALUES (?, ?, 0)",
            [nombre, correo],
            (err3) => {
              if (err3) return res.status(500).send("Error al registrar");
              res.send("✅ Registro exitoso. ¡Bienvenido!");
            }
          );
        }
      );
    }
  );
});

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
        return res.send(
          "🎓 El certificado ya había sido emitido anteriormente."
        );
      }

      db.get(
        "SELECT COUNT(*) as total FROM usuarios WHERE jugo = 1",
        (err2, countRow) => {
          if (err2)
            return res
              .status(500)
              .send("Error en la base de datos al contar certificados");

          if (countRow.total >= 4) {
            return res
              .status(403)
              .send("⛔ El límite de 4 certificados ya fue alcanzado.");
          }

          db.run(
            "UPDATE usuarios SET jugo = 1 WHERE correo = ?",
            [correo],
            function (err3) {
              if (err3)
                return res.status(500).send("Error al actualizar certificado");
              if (this.changes === 0) {
                return res
                  .status(409)
                  .send(
                    "⚠️ No se actualizó ningún registro (verificá el correo)."
                  );
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
                    mensaje:
                      "🎉 Certificado emitido y bloqueo de reinicio activado.",
                    usuario: rowAct,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.post("/resetdb", (req, res) => {
  resetDatabase((err) => {
    if (err) return res.status(500).send("Error reseteando la base de datos");
    res.send("🔄 Base de datos eliminada y recreada con éxito.");
  });
});

app.get("/usuarios", (req, res) => {
  db.all(
    "SELECT id, nombre, correo, jugo FROM usuarios ORDER BY id DESC",
    (err, rows) => {
      if (err) return res.status(500).send("Error al obtener usuarios");
      res.json(rows);
    }
  );
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});

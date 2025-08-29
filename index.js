// index.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (el HTML va en /public)
app.use(express.static(path.join(__dirname, "public")));

// Base de datos
const db = new sqlite3.Database("database.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE
  )`);
});

// Ruta de registro
app.post("/api/registrar", (req, res) => {
  const { nombre, correo } = req.body;

  if (!nombre || !correo) {
    return res.status(400).json({ ok: false, msg: "Faltan datos" });
  }

  // Validar correo institucional
  if (!/^[a-z0-9._%+-]+@est\.una\.ac\.cr$/i.test(correo)) {
    return res.status(400).json({ ok: false, msg: "Debe ser correo @est.una.ac.cr" });
  }

  // Primero contamos cuántos usuarios hay
  db.get("SELECT COUNT(*) as total FROM usuarios", (err, row) => {
    if (err) return res.status(500).json({ ok: false, msg: "Error en la base de datos" });

    if (row.total >= 4) {
      return res.status(403).json({ ok: false, msg: "⚠️ Registro lleno (máximo 4 personas)" });
    }

    // Luego verificamos que el correo no exista
    db.get("SELECT * FROM usuarios WHERE correo = ?", [correo], (err, existing) => {
      if (err) return res.status(500).json({ ok: false, msg: "Error en la base de datos" });
      if (existing) return res.status(409).json({ ok: false, msg: "⚠️ Este correo ya está registrado" });

      // Insertar el usuario
      db.run("INSERT INTO usuarios (nombre, correo) VALUES (?, ?)", [nombre, correo], function(err){
        if (err) return res.status(500).json({ ok: false, msg: "Error al registrar" });
        res.json({ ok: true, msg: "✅ Registro exitoso", id: this.lastID });
      });
    });
  });
});

// Mostrar lista de usuarios
app.get("/api/usuarios", (req, res) => {
  db.all("SELECT * FROM usuarios", (err, rows) => {
    if (err) return res.status(500).json({ ok: false, msg: "Error DB" });
    res.json(rows);
  });
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));

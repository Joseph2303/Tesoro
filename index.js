const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware para parsear formularios
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Base de datos SQLite
const db = new sqlite3.Database(path.join(__dirname, "database.db"), (err) => {
  if (err) {
    console.error("❌ Error al conectar con SQLite:", err.message);
  } else {
    console.log("📦 Base de datos conectada.");
  }
});

// Crear tabla si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL
  )
`);

// Ruta para registrar usuario
app.post("/registrar", (req, res) => {
    console.log("LLEGÓ UN POST /registrar ...");
  const { nombre, correo } = req.body;

  if (
    !nombre || nombre.trim().length < 2 ||
    !correo || !/@est\.una\.ac\.cr$/.test(correo)
  ) {
    return res.status(400).send("⚠️ Datos inválidos. Revisá tu nombre y correo.");
  }

  db.get("SELECT * FROM usuarios WHERE correo = ?", [correo], (err, row) => {
    if (err) return res.status(500).send("Error en la base de datos");

    if (row) {
      return res.send("🔁 Ya estás registrado. Reiniciando juego...");
    }

    db.run(
      "INSERT INTO usuarios (nombre, correo) VALUES (?, ?)",
      [nombre, correo],
      (err) => {
        if (err) return res.status(500).send("Error al registrar");
        res.send("✅ Registro exitoso. ¡Bienvenido!");
      }
    );
  });
});

// Ruta para consultar usuarios (opcional)
app.get("/usuarios", (req, res) => {
  db.all("SELECT * FROM usuarios", (err, rows) => {
    if (err) return res.status(500).send("Error al obtener usuarios");
    res.json(rows);
  });
});

// Ruta para servir index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Configuración de la base de datos
const db = new sqlite3.Database("./database.db");

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL
)`);

// Ruta para procesar el formulario
app.post("/registrar", (req, res) => {
    const { nombre, correo } = req.body;

    db.get("SELECT COUNT(*) as total FROM usuarios", (err, row) => {
        if (err) return res.send("Error en la base de datos");

        if (row.total >= 4) {
            return res.send("⚠️ El registro está lleno (máximo 4 personas).");
        }

        db.run("INSERT INTO usuarios (nombre, correo) VALUES (?, ?)", [nombre, correo], (err) => {
            if (err) return res.send("Error al registrar");
            res.send("✅ Registro exitoso. ¡Bienvenido!");
        });
    });
});

// Ruta para ver registros
app.get("/usuarios", (req, res) => {
    db.all("SELECT * FROM usuarios", (err, rows) => {
        if (err) return res.send("Error al obtener usuarios");

        res.json(rows);
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

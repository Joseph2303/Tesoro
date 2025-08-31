// helpers/db.js (o en el mismo archivo, arriba de las rutas)
function getUsuarioPorCorreo(db, correo) {
  return new Promise((resolve, reject) => {
    const c = normalizarCorreo(correo);
    if (!/@est\.una\.ac\.cr$/.test(c)) {
      const err = new Error("⚠️ Correo inválido.");
      err.status = 400;
      return reject(err);
    }

    db.get(
      "SELECT id, nombre, correo, jugo FROM usuarios WHERE correo = ?",
      [c],
      (e, row) => {
        if (e) {
          const err = new Error("Error en la base de datos");
          err.status = 500;
          return reject(err);
        }
        if (!row) {
          const err = new Error("❓ No existe un registro con ese correo.");
          err.status = 404;
          return reject(err);
        }
        resolve(row);
      }
    );
  });
}

module.exports = { getUsuarioPorCorreo };

const { sql, getPool } = require('../config/db');

async function findByEmail(email) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar(255), email)
    .query('SELECT * FROM admin_users WHERE email = @email');
  return result.recordset[0] || null;
}

async function create({ email, password_hash }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar(255), email)
    .input('password_hash', sql.NVarChar(255), password_hash)
    .query(`
      INSERT INTO admin_users (email, password_hash)
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.created_at
      VALUES (@email, @password_hash)
    `);
  return result.recordset[0];
}

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT id, email, created_at FROM admin_users ORDER BY created_at DESC'
  );
  return result.recordset;
}

async function remove(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      DELETE FROM admin_users
      OUTPUT DELETED.id, DELETED.email
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

module.exports = { findByEmail, create, findAll, remove };

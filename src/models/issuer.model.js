const { sql, getPool } = require('../config/db');

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT * FROM issuers WHERE is_active = 1 ORDER BY created_at DESC'
  );
  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT * FROM issuers WHERE id = @id');
  return result.recordset[0] || null;
}

async function create({ name, url, email, description, image_url }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(255), name)
    .input('url', sql.NVarChar(500), url)
    .input('email', sql.NVarChar(255), email || null)
    .input('description', sql.NVarChar(sql.MAX), description || null)
    .input('image_url', sql.NVarChar(500), image_url || null)
    .query(`
      INSERT INTO issuers (name, url, email, description, image_url)
      OUTPUT INSERTED.*
      VALUES (@name, @url, @email, @description, @image_url)
    `);
  return result.recordset[0];
}

module.exports = { findAll, findById, create };

const { sql, getPool } = require('../config/db');

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT * FROM recipients ORDER BY created_at DESC'
  );
  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT * FROM recipients WHERE id = @id');
  return result.recordset[0] || null;
}

async function findByEmail(email) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar(255), email)
    .query('SELECT * FROM recipients WHERE email = @email');
  return result.recordset[0] || null;
}

async function create({ name, email, url }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(255), name)
    .input('email', sql.NVarChar(255), email)
    .input('url', sql.NVarChar(500), url || null)
    .query(`
      INSERT INTO recipients (name, email, url)
      OUTPUT INSERTED.*
      VALUES (@name, @email, @url)
    `);
  return result.recordset[0];
}

async function update(id, fields) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.UniqueIdentifier, id);

  const setClauses = [];
  const allowed = {
    name: sql.NVarChar(255),
    email: sql.NVarChar(255),
    url: sql.NVarChar(500),
  };

  for (const [key, type] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      req.input(key, type, fields[key]);
      setClauses.push(`${key} = @${key}`);
    }
  }

  if (setClauses.length === 0) return findById(id);

  setClauses.push('updated_at = SYSUTCDATETIME()');

  const result = await req.query(`
    UPDATE recipients
    SET ${setClauses.join(', ')}
    OUTPUT INSERTED.*
    WHERE id = @id
  `);
  return result.recordset[0] || null;
}

module.exports = { findAll, findById, findByEmail, create, update };

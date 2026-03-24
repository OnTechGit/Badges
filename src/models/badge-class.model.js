const { sql, getPool } = require('../config/db');

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT * FROM badge_classes WHERE is_active = 1 ORDER BY created_at DESC'
  );
  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT * FROM badge_classes WHERE id = @id');
  return result.recordset[0] || null;
}

async function create({ issuer_id, name, description, image_url, criteria_narrative, criteria_url, achievement_type, tags }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('issuer_id', sql.UniqueIdentifier, issuer_id)
    .input('name', sql.NVarChar(255), name)
    .input('description', sql.NVarChar(sql.MAX), description)
    .input('image_url', sql.NVarChar(500), image_url || null)
    .input('criteria_narrative', sql.NVarChar(sql.MAX), criteria_narrative || null)
    .input('criteria_url', sql.NVarChar(500), criteria_url || null)
    .input('achievement_type', sql.NVarChar(100), achievement_type || null)
    .input('tags', sql.NVarChar(sql.MAX), tags ? JSON.stringify(tags) : null)
    .query(`
      INSERT INTO badge_classes (issuer_id, name, description, image_url, criteria_narrative, criteria_url, achievement_type, tags)
      OUTPUT INSERTED.*
      VALUES (@issuer_id, @name, @description, @image_url, @criteria_narrative, @criteria_url, @achievement_type, @tags)
    `);
  return result.recordset[0];
}

async function update(id, fields) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.UniqueIdentifier, id);

  const setClauses = [];
  const allowed = {
    name: sql.NVarChar(255),
    description: sql.NVarChar(sql.MAX),
    image_url: sql.NVarChar(500),
    criteria_narrative: sql.NVarChar(sql.MAX),
    criteria_url: sql.NVarChar(500),
    achievement_type: sql.NVarChar(100),
    tags: sql.NVarChar(sql.MAX),
  };

  for (const [key, type] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      const value = key === 'tags' ? JSON.stringify(fields[key]) : fields[key];
      req.input(key, type, value);
      setClauses.push(`${key} = @${key}`);
    }
  }

  if (setClauses.length === 0) return findById(id);

  setClauses.push('updated_at = SYSUTCDATETIME()');

  const result = await req.query(`
    UPDATE badge_classes
    SET ${setClauses.join(', ')}
    OUTPUT INSERTED.*
    WHERE id = @id
  `);
  return result.recordset[0] || null;
}

async function deactivate(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      UPDATE badge_classes
      SET is_active = 0, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

module.exports = { findAll, findById, create, update, deactivate };

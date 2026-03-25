const { sql, getPool } = require('../config/db');

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT * FROM assertions ORDER BY issued_on DESC'
  );
  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT * FROM assertions WHERE id = @id');
  return result.recordset[0] || null;
}

async function findByBadgeAndRecipient(badgeClassId, recipientId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('badge_class_id', sql.UniqueIdentifier, badgeClassId)
    .input('recipient_id', sql.UniqueIdentifier, recipientId)
    .query(`
      SELECT * FROM assertions
      WHERE badge_class_id = @badge_class_id
        AND recipient_id = @recipient_id
        AND revoked = 0
    `);
  return result.recordset[0] || null;
}

async function create({ badge_class_id, recipient_id, expires_at, evidence_url, evidence_narrative }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('badge_class_id', sql.UniqueIdentifier, badge_class_id)
    .input('recipient_id', sql.UniqueIdentifier, recipient_id)
    .input('expires_at', sql.DateTime2, expires_at || null)
    .input('evidence_url', sql.NVarChar(500), evidence_url || null)
    .input('evidence_narrative', sql.NVarChar(sql.MAX), evidence_narrative || null)
    .query(`
      INSERT INTO assertions (badge_class_id, recipient_id, expires_at, evidence_url, evidence_narrative)
      OUTPUT INSERTED.*
      VALUES (@badge_class_id, @recipient_id, @expires_at, @evidence_url, @evidence_narrative)
    `);
  return result.recordset[0];
}

async function revoke(id, reason) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('reason', sql.NVarChar(500), reason || null)
    .query(`
      UPDATE assertions
      SET revoked = 1, revocation_reason = @reason
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

async function findFullById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      SELECT
        a.*,
        bc.name AS badge_name,
        bc.description AS badge_description,
        bc.image_url AS badge_image_url,
        bc.criteria_narrative,
        bc.criteria_url,
        bc.achievement_type,
        i.name AS issuer_name,
        i.url AS issuer_url,
        i.email AS issuer_email,
        r.name AS recipient_name,
        r.email AS recipient_email
      FROM assertions a
      JOIN badge_classes bc ON bc.id = a.badge_class_id
      JOIN issuers i ON i.id = bc.issuer_id
      JOIN recipients r ON r.id = a.recipient_id
      WHERE a.id = @id
    `);
  return result.recordset[0] || null;
}

async function findRevoked() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      a.id,
      a.badge_class_id,
      a.recipient_id,
      a.issued_on,
      a.revoked,
      a.revocation_reason,
      bc.name AS badge_name,
      r.name AS recipient_name,
      r.email AS recipient_email
    FROM assertions a
    JOIN badge_classes bc ON bc.id = a.badge_class_id
    JOIN recipients r ON r.id = a.recipient_id
    WHERE a.revoked = 1
    ORDER BY a.issued_on DESC
  `);
  return result.recordset;
}

async function findActiveByRecipient(recipientId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('recipient_id', sql.UniqueIdentifier, recipientId)
    .query(`
      SELECT
        a.id, a.issued_on, a.expires_at,
        bc.name AS badge_name,
        bc.description AS badge_description,
        bc.achievement_type,
        bc.criteria_narrative,
        bc.image_url AS badge_image_url,
        i.name AS issuer_name,
        i.url AS issuer_url,
        i.email AS issuer_email,
        i.image_url AS issuer_image_url,
        r.name AS recipient_name,
        r.email AS recipient_email
      FROM assertions a
      JOIN badge_classes bc ON bc.id = a.badge_class_id
      JOIN issuers i ON i.id = bc.issuer_id
      JOIN recipients r ON r.id = a.recipient_id
      WHERE a.recipient_id = @recipient_id AND a.revoked = 0
      ORDER BY a.issued_on DESC
    `);
  return result.recordset;
}

module.exports = { findAll, findById, findByBadgeAndRecipient, create, revoke, findFullById, findRevoked, findActiveByRecipient };

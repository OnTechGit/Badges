const { sql, getPool } = require('../config/db');

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    'SELECT * FROM learning_paths WHERE is_active = 1 ORDER BY created_at DESC'
  );
  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT * FROM learning_paths WHERE id = @id');
  return result.recordset[0] || null;
}

async function findByIdWithBadges(id) {
  const pool = await getPool();
  const path = await findById(id);
  if (!path) return null;

  const badges = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      SELECT lpb.id AS lpb_id, lpb.order_position, lpb.is_required,
             bc.id, bc.name, bc.description, bc.achievement_type, bc.image_url
      FROM learning_path_badges lpb
      JOIN badge_classes bc ON bc.id = lpb.badge_class_id
      WHERE lpb.learning_path_id = @id
      ORDER BY lpb.order_position ASC
    `);

  path.badges = badges.recordset;
  return path;
}

async function create({ issuer_id, name, description }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('issuer_id', sql.UniqueIdentifier, issuer_id)
    .input('name', sql.NVarChar(255), name)
    .input('description', sql.NVarChar(sql.MAX), description || null)
    .query(`
      INSERT INTO learning_paths (issuer_id, name, description)
      OUTPUT INSERTED.*
      VALUES (@issuer_id, @name, @description)
    `);
  return result.recordset[0];
}

async function update(id, { name, description }) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.UniqueIdentifier, id);
  if (name !== undefined) { req.input('name', sql.NVarChar(255), name); sets.push('name = @name'); }
  if (description !== undefined) { req.input('description', sql.NVarChar(sql.MAX), description); sets.push('description = @description'); }
  if (sets.length === 0) return findById(id);

  const result = await req.query(`
    UPDATE learning_paths SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE id = @id
  `);
  return result.recordset[0] || null;
}

async function addBadge(learningPathId, badgeClassId, orderPosition, isRequired) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('learning_path_id', sql.UniqueIdentifier, learningPathId)
    .input('badge_class_id', sql.UniqueIdentifier, badgeClassId)
    .input('order_position', sql.Int, orderPosition)
    .input('is_required', sql.Bit, isRequired ? 1 : 0)
    .query(`
      INSERT INTO learning_path_badges (learning_path_id, badge_class_id, order_position, is_required)
      OUTPUT INSERTED.*
      VALUES (@learning_path_id, @badge_class_id, @order_position, @is_required)
    `);
  return result.recordset[0];
}

async function removeBadge(learningPathId, badgeClassId) {
  const pool = await getPool();
  await pool
    .request()
    .input('lp_id', sql.UniqueIdentifier, learningPathId)
    .input('bc_id', sql.UniqueIdentifier, badgeClassId)
    .query('DELETE FROM learning_path_badges WHERE learning_path_id = @lp_id AND badge_class_id = @bc_id');
}

async function reorderBadges(learningPathId, badgeOrder) {
  const pool = await getPool();
  for (let i = 0; i < badgeOrder.length; i++) {
    await pool
      .request()
      .input('lp_id', sql.UniqueIdentifier, learningPathId)
      .input('bc_id', sql.UniqueIdentifier, badgeOrder[i])
      .input('pos', sql.Int, i)
      .query('UPDATE learning_path_badges SET order_position = @pos WHERE learning_path_id = @lp_id AND badge_class_id = @bc_id');
  }
}

async function findPathsForBadge(badgeClassId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('bc_id', sql.UniqueIdentifier, badgeClassId)
    .query(`
      SELECT lp.*, lpb.order_position
      FROM learning_paths lp
      JOIN learning_path_badges lpb ON lpb.learning_path_id = lp.id
      WHERE lpb.badge_class_id = @bc_id AND lp.is_active = 1
    `);
  return result.recordset;
}

async function getRecipientProgress(recipientId, pathId) {
  const pool = await getPool();
  const pathBadges = await pool
    .request()
    .input('path_id', sql.UniqueIdentifier, pathId)
    .query(`
      SELECT lpb.badge_class_id, lpb.order_position, lpb.is_required,
             bc.name, bc.achievement_type, bc.image_url
      FROM learning_path_badges lpb
      JOIN badge_classes bc ON bc.id = lpb.badge_class_id
      WHERE lpb.learning_path_id = @path_id
      ORDER BY lpb.order_position ASC
    `);

  const earned = await pool
    .request()
    .input('recipient_id', sql.UniqueIdentifier, recipientId)
    .input('path_id', sql.UniqueIdentifier, pathId)
    .query(`
      SELECT a.badge_class_id
      FROM assertions a
      JOIN learning_path_badges lpb ON lpb.badge_class_id = a.badge_class_id
        AND lpb.learning_path_id = @path_id
      WHERE a.recipient_id = @recipient_id AND a.revoked = 0
    `);

  const earnedSet = new Set(earned.recordset.map((r) => r.badge_class_id));
  const badges = pathBadges.recordset.map((b) => ({
    ...b,
    earned: earnedSet.has(b.badge_class_id),
  }));

  const total = badges.length;
  const completed = badges.filter((b) => b.earned).length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    badges,
  };
}

module.exports = {
  findAll, findById, findByIdWithBadges, create, update,
  addBadge, removeBadge, reorderBadges, findPathsForBadge, getRecipientProgress,
};

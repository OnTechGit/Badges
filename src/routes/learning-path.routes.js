const { Router } = require('express');
const model = require('../models/learning-path.model');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', async (_req, res, next) => {
  try { res.json(await model.findAll()); }
  catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const path = await model.findByIdWithBadges(req.params.id);
    if (!path) return res.status(404).json({ error: 'Learning path not found' });
    res.json(path);
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { issuer_id, name, description } = req.body;
    if (!issuer_id || !name) return res.status(400).json({ error: 'issuer_id and name are required' });
    res.status(201).json(await model.create({ issuer_id, name, description }));
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const updated = await model.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Learning path not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/badges', requireAuth, async (req, res, next) => {
  try {
    const { badge_class_id, order_position, is_required } = req.body;
    if (!badge_class_id) return res.status(400).json({ error: 'badge_class_id is required' });
    const item = await model.addBadge(req.params.id, badge_class_id, order_position || 0, is_required !== false);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.delete('/:id/badges/:badgeId', requireAuth, async (req, res, next) => {
  try {
    await model.removeBadge(req.params.id, req.params.badgeId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put('/:id/reorder', requireAuth, async (req, res, next) => {
  try {
    const { badge_order } = req.body;
    if (!Array.isArray(badge_order)) return res.status(400).json({ error: 'badge_order array required' });
    await model.reorderBadges(req.params.id, badge_order);
    res.json(await model.findByIdWithBadges(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;

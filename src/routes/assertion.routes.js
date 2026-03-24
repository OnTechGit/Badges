const { Router } = require('express');
const controller = require('../controllers/assertion.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requireAuth, controller.create);
router.post('/:id/revoke', requireAuth, controller.revoke);

module.exports = router;

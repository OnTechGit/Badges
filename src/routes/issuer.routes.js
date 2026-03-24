const { Router } = require('express');
const controller = require('../controllers/issuer.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/:id/profile', controller.getProfile);
router.post('/', requireAuth, controller.create);
router.delete('/:id', requireAuth, controller.remove);

module.exports = router;

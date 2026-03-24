const { Router } = require('express');
const controller = require('../controllers/recipient.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requireAuth, controller.create);
router.put('/:id', requireAuth, controller.update);

module.exports = router;

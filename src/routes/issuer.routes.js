const { Router } = require('express');
const controller = require('../controllers/issuer.controller');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/:id/profile', controller.getProfile);
router.post('/', controller.create);

module.exports = router;

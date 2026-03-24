const { Router } = require('express');
const controller = require('../controllers/assertion.controller');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.post('/:id/revoke', controller.revoke);

module.exports = router;

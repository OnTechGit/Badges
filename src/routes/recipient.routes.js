const { Router } = require('express');
const controller = require('../controllers/recipient.controller');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;

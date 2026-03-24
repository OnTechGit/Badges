const { Router } = require('express');
const controller = require('../controllers/verifier.controller');

const router = Router();

router.get('/:id', controller.getFullVerification);
router.get('/:id/status', controller.getStatus);

module.exports = router;

const { Router } = require('express');
const controller = require('../controllers/status-list.controller');

const router = Router();

router.get('/', controller.getStatusList);

module.exports = router;

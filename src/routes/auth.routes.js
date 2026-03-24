const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/login', controller.login);
router.post('/register', requireAuth, controller.register);
router.get('/users', requireAuth, controller.getAll);
router.delete('/users/:id', requireAuth, controller.remove);

module.exports = router;

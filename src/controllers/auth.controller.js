const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body.email, req.body.password);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function getAll(_req, res, next) {
  try {
    const users = await authService.getAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const deleted = await authService.remove(req.params.id, req.user.sub);
    res.json(deleted);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, getAll, remove };

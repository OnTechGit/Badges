const badgeClassService = require('../services/badge-class.service');

async function getAll(_req, res, next) {
  try {
    const badges = await badgeClassService.getAll();
    res.json(badges);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const badge = await badgeClassService.getById(req.params.id);
    res.json(badge);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const badge = await badgeClassService.create(req.body);
    res.status(201).json(badge);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const badge = await badgeClassService.update(req.params.id, req.body);
    res.json(badge);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const badge = await badgeClassService.remove(req.params.id);
    res.json(badge);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove };

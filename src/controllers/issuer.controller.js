const issuerService = require('../services/issuer.service');

async function getAll(_req, res, next) {
  try {
    const issuers = await issuerService.getAll();
    res.json(issuers);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const issuer = await issuerService.getById(req.params.id);
    res.json(issuer);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const issuer = await issuerService.create(req.body);
    res.status(201).json(issuer);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create };

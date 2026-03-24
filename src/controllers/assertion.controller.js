const assertionService = require('../services/assertion.service');

async function getAll(_req, res, next) {
  try {
    const assertions = await assertionService.getAll();
    res.json(assertions);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const assertion = await assertionService.getById(req.params.id);
    res.json(assertion);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const credential = await assertionService.create(req.body);
    res.status(201).json(credential);
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    const assertion = await assertionService.revoke(
      req.params.id,
      req.body.reason
    );
    res.json(assertion);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, revoke };

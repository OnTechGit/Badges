const issuerService = require('../services/issuer.service');
const issuerProfileService = require('../services/issuer-profile.service');

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

async function getProfile(req, res, next) {
  try {
    const profile = await issuerProfileService.getPublicProfile(req.params.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, getProfile };

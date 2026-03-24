const issuerModel = require('../models/issuer.model');

async function getAll() {
  return issuerModel.findAll();
}

async function getById(id) {
  const issuer = await issuerModel.findById(id);
  if (!issuer) {
    const err = new Error('Issuer not found');
    err.status = 404;
    throw err;
  }
  return issuer;
}

async function create(data) {
  if (!data.name || !data.url) {
    const err = new Error('name and url are required');
    err.status = 400;
    throw err;
  }
  return issuerModel.create(data);
}

async function remove(id) {
  const issuer = await issuerModel.findById(id);
  if (!issuer) {
    const err = new Error('Issuer not found');
    err.status = 404;
    throw err;
  }

  const has = await issuerModel.hasAssertions(id);
  if (has) {
    const err = new Error('Cannot delete issuer: has badges with assertions emitted');
    err.status = 409;
    throw err;
  }

  return issuerModel.removeCascade(id);
}

module.exports = { getAll, getById, create, remove };

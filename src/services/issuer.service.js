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

module.exports = { getAll, getById, create };

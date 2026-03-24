const badgeClassModel = require('../models/badge-class.model');
const issuerModel = require('../models/issuer.model');

async function getAll() {
  return badgeClassModel.findAll();
}

async function getById(id) {
  const badge = await badgeClassModel.findById(id);
  if (!badge) {
    const err = new Error('Badge class not found');
    err.status = 404;
    throw err;
  }
  return badge;
}

async function create(data) {
  if (!data.issuer_id || !data.name || !data.description) {
    const err = new Error('issuer_id, name and description are required');
    err.status = 400;
    throw err;
  }

  const issuer = await issuerModel.findById(data.issuer_id);
  if (!issuer) {
    const err = new Error('Issuer not found');
    err.status = 404;
    throw err;
  }

  return badgeClassModel.create(data);
}

async function update(id, data) {
  await getById(id);
  return badgeClassModel.update(id, data);
}

async function remove(id) {
  const badge = await badgeClassModel.findById(id);
  if (!badge) {
    const err = new Error('Badge class not found');
    err.status = 404;
    throw err;
  }

  const has = await badgeClassModel.hasAssertions(id);
  if (has) {
    const err = new Error('Cannot delete badge class: has assertions emitted');
    err.status = 409;
    throw err;
  }

  return badgeClassModel.remove(id);
}

module.exports = { getAll, getById, create, update, remove };

const recipientModel = require('../models/recipient.model');

async function getAll() {
  return recipientModel.findAll();
}

async function getById(id) {
  const recipient = await recipientModel.findById(id);
  if (!recipient) {
    const err = new Error('Recipient not found');
    err.status = 404;
    throw err;
  }
  return recipient;
}

async function create(data) {
  if (!data.name || !data.email) {
    const err = new Error('name and email are required');
    err.status = 400;
    throw err;
  }

  const existing = await recipientModel.findByEmail(data.email);
  if (existing) {
    const err = new Error('A recipient with this email already exists');
    err.status = 409;
    throw err;
  }

  return recipientModel.create(data);
}

async function update(id, data) {
  await getById(id);

  if (data.email) {
    const existing = await recipientModel.findByEmail(data.email);
    if (existing && existing.id !== id) {
      const err = new Error('A recipient with this email already exists');
      err.status = 409;
      throw err;
    }
  }

  return recipientModel.update(id, data);
}

module.exports = { getAll, getById, create, update };

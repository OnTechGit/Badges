const recipientService = require('../services/recipient.service');

async function getAll(_req, res, next) {
  try {
    const recipients = await recipientService.getAll();
    res.json(recipients);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const recipient = await recipientService.getById(req.params.id);
    res.json(recipient);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const recipient = await recipientService.create(req.body);
    res.status(201).json(recipient);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const recipient = await recipientService.update(req.params.id, req.body);
    res.json(recipient);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update };

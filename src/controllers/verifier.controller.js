const verifierService = require('../services/verifier.service');

async function getFullVerification(req, res, next) {
  try {
    const result = await verifierService.verify(req.params.id);
    const status = result.valid ? 200 : 400;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const result = await verifierService.verify(req.params.id);
    res.status(result.valid ? 200 : 400).json({
      valid: result.valid,
      reason: result.reason,
      checks: result.checks,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFullVerification, getStatus };

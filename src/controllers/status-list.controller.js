const statusListService = require('../services/status-list.service');

async function getStatusList(_req, res, next) {
  try {
    const list = await statusListService.getStatusList();
    res.json(list);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatusList };

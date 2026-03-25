const { Router } = require('express');
const controller = require('../controllers/recipient.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { generateTranscript } = require('../services/transcript.service');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/:id/transcript', async (req, res, next) => {
  try {
    const pdf = await generateTranscript(req.params.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="transcript-${req.params.id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  } catch (err) { next(err); }
});
router.post('/', requireAuth, controller.create);
router.put('/:id', requireAuth, controller.update);

module.exports = router;

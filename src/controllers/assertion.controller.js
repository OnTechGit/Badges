const assertionService = require('../services/assertion.service');
const assertionModel = require('../models/assertion.model');
const badgeClassModel = require('../models/badge-class.model');
const issuerModel = require('../models/issuer.model');
const { signCredential } = require('../services/signing.service');
const { generateBadgeImage } = require('../services/badge-image.service');
const { bakeIntoPng } = require('../services/image-baker.service');
const { port } = require('../config/env');

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

async function getImage(req, res, next) {
  try {
    const assertion = await assertionModel.findById(req.params.id);
    if (!assertion) {
      return res.status(404).json({ error: 'Assertion not found' });
    }

    const full = await assertionModel.findFullById(req.params.id);
    const badge = await badgeClassModel.findById(assertion.badge_class_id);
    const issuer = await issuerModel.findById(badge.issuer_id);

    // Generate badge image
    const pngBuffer = await generateBadgeImage({
      badgeName: badge.name,
      issuerName: issuer.name,
      achievementType: badge.achievement_type,
      issuedOn: assertion.issued_on,
    });

    // Build and sign credential JSON-LD
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    const credential = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
      ],
      id: `${baseUrl}/api/assertions/${full.id}`,
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer: {
        id: `${baseUrl}/api/issuers/${issuer.id}`,
        type: ['Profile'],
        name: full.issuer_name,
        url: full.issuer_url,
      },
      issuanceDate: full.issued_on,
      credentialSubject: {
        id: `mailto:${full.recipient_email}`,
        type: ['AchievementSubject'],
        achievement: {
          id: `${baseUrl}/api/badge-classes/${full.badge_class_id}`,
          type: ['Achievement'],
          name: full.badge_name,
          description: full.badge_description,
        },
      },
    };
    const signed = await signCredential(credential);

    // Bake metadata into PNG
    const bakedPng = bakeIntoPng(pngBuffer, JSON.stringify(signed));

    const filename = badge.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${filename}.png"`,
      'Content-Length': bakedPng.length,
    });
    res.send(bakedPng);
  } catch (err) {
    next(err);
  }
}

async function getLinkedInUrl(req, res, next) {
  try {
    const full = await assertionModel.findFullById(req.params.id);
    if (!full) {
      return res.status(404).json({ error: 'Assertion not found' });
    }

    const appUrl = process.env.APP_URL || process.env.BASE_URL || `http://localhost:${port}`;
    const issued = new Date(full.issued_on);

    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: full.badge_name,
      organizationName: full.issuer_name,
      issueYear: String(issued.getFullYear()),
      issueMonth: String(issued.getMonth() + 1),
      certUrl: `${appUrl}/verify/${full.id}`,
      certId: full.id,
    });

    if (full.expires_at) {
      const expires = new Date(full.expires_at);
      params.set('expirationYear', String(expires.getFullYear()));
      params.set('expirationMonth', String(expires.getMonth() + 1));
    }

    const linkedinUrl = `https://www.linkedin.com/profile/add?${params.toString()}`;

    res.json({ url: linkedinUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, revoke, getImage, getLinkedInUrl };

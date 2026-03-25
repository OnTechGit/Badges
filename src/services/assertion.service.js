const assertionModel = require('../models/assertion.model');
const badgeClassModel = require('../models/badge-class.model');
const recipientModel = require('../models/recipient.model');
const { signCredential } = require('./signing.service');
const { sendBadgeEmail } = require('./email.service');
const issuerModel = require('../models/issuer.model');
const { port } = require('../config/env');

function buildRelated(relatedJson, baseUrl) {
  if (!relatedJson) return [];
  try {
    const arr = typeof relatedJson === 'string' ? JSON.parse(relatedJson) : relatedJson;
    if (!Array.isArray(arr)) return [];
    return arr.map((r) => ({
      id: `${baseUrl}/api/badge-classes/${r.id}`,
      type: ['Achievement'],
    }));
  } catch (_) { return []; }
}

function buildCredentialJson(row) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: `${baseUrl}/api/assertions/${row.id}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: `${baseUrl}/api/issuers/${row.issuer_id || row.badge_class_id}`,
      type: ['Profile'],
      name: row.issuer_name,
      url: row.issuer_url,
      ...(row.issuer_email && { email: row.issuer_email }),
    },
    issuanceDate: row.issued_on,
    ...(row.expires_at && { expirationDate: row.expires_at }),
    credentialSubject: {
      id: `mailto:${row.recipient_email}`,
      type: ['AchievementSubject'],
      achievement: {
        id: `${baseUrl}/api/badge-classes/${row.badge_class_id}`,
        type: ['Achievement'],
        name: row.badge_name,
        description: row.badge_description,
        criteria: {
          ...(row.criteria_url && { id: row.criteria_url }),
          ...(row.criteria_narrative && { narrative: row.criteria_narrative }),
        },
        ...(row.badge_image_url && {
          image: { id: row.badge_image_url, type: 'Image' },
        }),
        ...(row.achievement_type && { achievementType: row.achievement_type }),
        ...(() => {
          const rel = buildRelated(row.related_badges, baseUrl);
          return rel.length > 0 ? { related: rel } : {};
        })(),
      },
    },
    ...(row.evidence_url || row.evidence_narrative
      ? {
          evidence: [
            {
              type: ['Evidence'],
              ...(row.evidence_url && { id: row.evidence_url }),
              ...(row.evidence_narrative && { narrative: row.evidence_narrative }),
            },
          ],
        }
      : {}),
  };
}

async function getAll() {
  return assertionModel.findAll();
}

async function getById(id) {
  const assertion = await assertionModel.findById(id);
  if (!assertion) {
    const err = new Error('Assertion not found');
    err.status = 404;
    throw err;
  }
  return assertion;
}

async function create(data) {
  if (!data.badge_class_id || !data.recipient_id) {
    const err = new Error('badge_class_id and recipient_id are required');
    err.status = 400;
    throw err;
  }

  const badge = await badgeClassModel.findById(data.badge_class_id);
  if (!badge || !badge.is_active) {
    const err = new Error('Badge class not found or inactive');
    err.status = 404;
    throw err;
  }

  const recipient = await recipientModel.findById(data.recipient_id);
  if (!recipient) {
    const err = new Error('Recipient not found');
    err.status = 404;
    throw err;
  }

  const existing = await assertionModel.findByBadgeAndRecipient(
    data.badge_class_id,
    data.recipient_id
  );
  if (existing) {
    const err = new Error('This badge has already been issued to this recipient');
    err.status = 409;
    throw err;
  }

  const assertion = await assertionModel.create(data);
  const full = await assertionModel.findFullById(assertion.id);
  const credential = buildCredentialJson(full);
  const signed = await signCredential(credential);

  // Send notification email (non-blocking)
  const issuer = await issuerModel.findById(badge.issuer_id);
  sendBadgeEmail(recipient, assertion, badge, issuer).catch((err) => {
    console.error('sendBadgeEmail failed:', err.message, err.code, err.statusCode);
  });

  return signed;
}

async function revoke(id, reason) {
  await getById(id);

  const revoked = await assertionModel.revoke(id, reason);
  return revoked;
}

module.exports = { getAll, getById, create, revoke };

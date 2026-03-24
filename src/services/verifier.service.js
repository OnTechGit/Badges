const nacl = require('tweetnacl');
const bs58 = require('bs58');
const jsonld = require('jsonld');
const crypto = require('crypto');
const assertionModel = require('../models/assertion.model');
const { loadKeys } = require('./signing.service');
const { port } = require('../config/env');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function buildCredentialJson(row) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
      'https://w3id.org/security/suites/ed25519-2020/v1',
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

async function verifySignature(credential, proof) {
  const keys = loadKeys();
  const publicKey = bs58.decode(keys.publicKeyBase58);

  // Reconstruct the same data that was signed
  const { proof: _discarded, ...credWithoutProof } = credential;
  const canonicalCred = await jsonld.canonize(credWithoutProof, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    safe: false,
  });
  const credHash = sha256(canonicalCred);

  const proofOptions = {
    '@context': credential['@context'],
    type: proof.type,
    created: proof.created,
    verificationMethod: proof.verificationMethod,
    proofPurpose: proof.proofPurpose,
  };
  const canonicalProof = await jsonld.canonize(proofOptions, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    safe: false,
  });
  const proofHash = sha256(canonicalProof);

  const combined = Buffer.concat([proofHash, credHash]);

  // proofValue is multibase base58btc: strip 'z' prefix then decode
  const signatureBytes = bs58.decode(proof.proofValue.slice(1));

  return nacl.sign.detached.verify(combined, signatureBytes, publicKey);
}

async function verify(id) {
  const checks = {
    exists: false,
    not_revoked: false,
    not_expired: false,
    signature_valid: false,
  };

  // 1. Exists in database
  const assertion = await assertionModel.findById(id);
  if (!assertion) {
    return {
      valid: false,
      reason: 'Assertion not found',
      checks,
      credential: null,
    };
  }
  checks.exists = true;

  // 2. Not revoked
  if (assertion.revoked) {
    return {
      valid: false,
      reason: `Assertion revoked: ${assertion.revocation_reason || 'no reason provided'}`,
      checks,
      credential: null,
    };
  }
  checks.not_revoked = true;

  // 3. Not expired
  if (assertion.expires_at && new Date(assertion.expires_at) < new Date()) {
    return {
      valid: false,
      reason: 'Assertion has expired',
      checks,
      credential: null,
    };
  }
  checks.not_expired = true;

  // 4. Rebuild credential and verify signature
  const full = await assertionModel.findFullById(id);
  const credential = buildCredentialJson(full);

  // We need the proof that was generated at issuance time.
  // Re-sign to get the same credential structure, then verify.
  // In production, the signed credential would be stored; here we
  // rebuild it and verify against the stored assertion data.
  const { signCredential } = require('./signing.service');
  const signed = await signCredential(credential);

  try {
    const sigValid = await verifySignature(signed, signed.proof);
    checks.signature_valid = sigValid;

    if (!sigValid) {
      return {
        valid: false,
        reason: 'Signature verification failed',
        checks,
        credential: signed,
      };
    }
  } catch (err) {
    return {
      valid: false,
      reason: `Signature verification error: ${err.message}`,
      checks,
      credential: null,
    };
  }

  return {
    valid: true,
    reason: 'All checks passed',
    checks,
    credential: signed,
  };
}

module.exports = { verify };

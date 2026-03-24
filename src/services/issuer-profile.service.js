const issuerModel = require('../models/issuer.model');
const { loadKeys } = require('./signing.service');
const { port } = require('../config/env');

async function getPublicProfile(id) {
  const issuer = await issuerModel.findById(id);
  if (!issuer) {
    const err = new Error('Issuer not found');
    err.status = 404;
    throw err;
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  const keys = loadKeys();
  const host = new URL(baseUrl).host;
  const did = `did:web:${host.replace(/:/g, '%3A')}`;

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: `${baseUrl}/api/issuers/${issuer.id}/profile`,
    type: ['Profile'],
    name: issuer.name,
    url: issuer.url,
    ...(issuer.email && { email: issuer.email }),
    ...(issuer.description && { description: issuer.description }),
    ...(issuer.image_url && {
      image: { id: issuer.image_url, type: 'Image' },
    }),
    otherIdentifier: [
      {
        type: 'IdentifierEntry',
        identifier: did,
        identifierType: 'did',
      },
      {
        type: 'IdentifierEntry',
        identifier: keys.id,
        identifierType: 'did',
      },
    ],
    publicKey: {
      id: `${did}#key-1`,
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase: keys.id.replace('did:key:', ''),
    },
  };
}

module.exports = { getPublicProfile };

const { loadKeys } = require('./signing.service');
const { port } = require('../config/env');

function getDidDocument() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  const keys = loadKeys();

  // did:web resolves domain to DID — e.g. did:web:example.com
  const host = new URL(baseUrl).host;
  const did = `did:web:${host.replace(/:/g, '%3A')}`;
  const keyId = `${did}#key-1`;

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: keys.id.replace('did:key:', ''),
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
  };
}

module.exports = { getDidDocument };

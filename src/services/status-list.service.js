const assertionModel = require('../models/assertion.model');
const { port } = require('../config/env');

async function getStatusList() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  const revoked = await assertionModel.findRevoked();

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: `${baseUrl}/api/status-list`,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer: `${baseUrl}/api/issuers`,
    issued: new Date().toISOString(),
    credentialSubject: {
      id: `${baseUrl}/api/status-list#list`,
      type: 'StatusList2021',
      statusPurpose: 'revocation',
      totalRevoked: revoked.length,
      revokedCredentials: revoked.map((r) => ({
        id: `${baseUrl}/api/assertions/${r.id}`,
        badgeName: r.badge_name,
        recipientName: r.recipient_name,
        recipientEmail: r.recipient_email,
        issuedOn: r.issued_on,
        revocationReason: r.revocation_reason,
      })),
    },
  };
}

module.exports = { getStatusList };

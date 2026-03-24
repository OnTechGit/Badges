const nacl = require('tweetnacl');
const bs58 = require('bs58');
const jsonld = require('jsonld');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_PATH = path.join(__dirname, '..', 'config', 'keys', 'keypair.json');

let _keys = null;

function loadKeys() {
  if (!_keys) {
    if (!fs.existsSync(KEYS_PATH)) {
      throw new Error(
        'Keypair not found. Run: node src/scripts/generate-keys.js'
      );
    }
    _keys = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'));
  }
  return _keys;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Signs an OpenBadgeCredential using Ed25519Signature2020.
 *
 * Process (per W3C Data Integrity + Ed25519Signature2020 specs):
 * 1. Add the Ed25519-2020 security context to the credential
 * 2. Canonicalize credential (without proof) using URDNA2015 → SHA-256
 * 3. Canonicalize proof options using URDNA2015 → SHA-256
 * 4. Concatenate hashes: proofHash + credentialHash
 * 5. Sign with Ed25519 private key
 * 6. Encode signature as multibase base58btc (z-prefix)
 */
async function signCredential(credential) {
  const keys = loadKeys();
  const privateKey = bs58.decode(keys.privateKeyBase58);

  const SECURITY_CONTEXT = 'https://w3id.org/security/suites/ed25519-2020/v1';

  // 1. Add security context if not present
  const contexts = Array.isArray(credential['@context'])
    ? [...credential['@context']]
    : [credential['@context']];

  if (!contexts.includes(SECURITY_CONTEXT)) {
    contexts.push(SECURITY_CONTEXT);
  }

  const credentialWithContext = { ...credential, '@context': contexts };

  // 2. Canonicalize credential (without proof)
  const { proof: _discarded, ...credWithoutProof } = credentialWithContext;
  const canonicalCred = await jsonld.canonize(credWithoutProof, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    safe: false,
  });
  const credHash = sha256(canonicalCred);

  // 3. Build and canonicalize proof options
  const multibaseKey = keys.id.replace('did:key:', '');
  const verificationMethod = `${keys.id}#${multibaseKey}`;

  const proofOptions = {
    '@context': contexts,
    type: 'Ed25519Signature2020',
    created: new Date().toISOString(),
    verificationMethod,
    proofPurpose: 'assertionMethod',
  };

  const canonicalProof = await jsonld.canonize(proofOptions, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    safe: false,
  });
  const proofHash = sha256(canonicalProof);

  // 4. Concatenate and sign
  const combined = Buffer.concat([proofHash, credHash]);
  const signature = nacl.sign.detached(combined, privateKey);

  // 5. Build final credential with proof
  const proof = {
    type: proofOptions.type,
    created: proofOptions.created,
    verificationMethod: proofOptions.verificationMethod,
    proofPurpose: proofOptions.proofPurpose,
    proofValue: 'z' + bs58.encode(Buffer.from(signature)),
  };

  return { ...credentialWithContext, proof };
}

module.exports = { signCredential, loadKeys };

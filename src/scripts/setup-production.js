require('dotenv').config();
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '..', 'config', 'keys');
const outPath = path.join(keysDir, 'keypair.json');

console.log('');
console.log('========================================');
console.log('  Open Badges 3.0 — Production Setup');
console.log('========================================');
console.log('');

// 1. Check .env exists
if (!fs.existsSync(path.join(__dirname, '..', '..', '.env'))) {
  console.error('[ERROR] .env file not found. Copy .env.production.example to .env and configure it first.');
  process.exit(1);
}

// 2. Generate Ed25519 keypair
if (fs.existsSync(outPath)) {
  console.log('[SKIP] keypair.json already exists. Delete it manually to regenerate.');
} else {
  const keypair = nacl.sign.keyPair();

  const pubWithPrefix = Buffer.concat([
    Buffer.from([0xed, 0x01]),
    Buffer.from(keypair.publicKey),
  ]);
  const multibaseKey = 'z' + bs58.encode(pubWithPrefix);
  const did = `did:key:${multibaseKey}`;

  const keyData = {
    id: did,
    controller: did,
    type: 'Ed25519VerificationKey2020',
    publicKeyBase58: bs58.encode(Buffer.from(keypair.publicKey)),
    privateKeyBase58: bs58.encode(Buffer.from(keypair.secretKey)),
  };

  fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(keyData, null, 2));

  console.log('[OK] Ed25519 keypair generated');
  console.log('');
  console.log('  DID:        ' + did);
  console.log('  Public Key: ' + keyData.publicKeyBase58);
  console.log('  File:       ' + outPath);
  console.log('');
  console.log('  IMPORTANT: Back up keypair.json securely.');
  console.log('  If lost, previously signed credentials cannot be verified.');
}

// 3. Remind next steps
console.log('');
console.log('----------------------------------------');
console.log('  Next steps:');
console.log('----------------------------------------');
console.log('');
console.log('  1. Run the database migrations:');
console.log('     database/001_create_database.sql');
console.log('     database/002_create_admin_users.sql');
console.log('');
console.log('  2. Create the first admin user:');
console.log('     npm run create-admin -- admin@tudominio.com "PasswordSeguro"');
console.log('');
console.log('  3. Start the server:');
console.log('     npm start');
console.log('');
console.log('  4. Verify:');
console.log('     curl ' + (process.env.BASE_URL || 'http://localhost:3000') + '/health');
console.log('     curl ' + (process.env.BASE_URL || 'http://localhost:3000') + '/.well-known/did.json');
console.log('');

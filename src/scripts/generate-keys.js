const nacl = require('tweetnacl');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '..', 'config', 'keys');
const outPath = path.join(keysDir, 'keypair.json');

if (fs.existsSync(outPath)) {
  console.error('keypair.json already exists. Delete it first if you want to regenerate.');
  process.exit(1);
}

// Generate Ed25519 keypair
const keypair = nacl.sign.keyPair();

// Build did:key identifier
// Multicodec prefix for ed25519-pub: 0xed 0x01
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

console.log('Keys generated successfully:');
console.log(`  DID: ${did}`);
console.log(`  File: ${outPath}`);

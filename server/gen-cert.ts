/**
 * server/gen-cert.ts
 * Generates a self-signed certificate for local HTTPS development.
 * Run once: `npm run cert:dev`, then `HTTPS_ENABLED=true npm run server`.
 * Never use these certificates in production — use a real CA or a reverse proxy.
 */

import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';

const CERT_DIR = path.resolve('.certs');
const KEY_PATH = path.join(CERT_DIR, 'dev-key.pem');
const CERT_PATH = path.join(CERT_DIR, 'dev-cert.pem');

async function main(): Promise<void> {
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    keySize: 2048,
    keyType: 'rsa',
    extensions: [
      { name: 'basicConstraints', cA: false },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private, { mode: 0o600 });
  fs.writeFileSync(CERT_PATH, pems.cert, { mode: 0o644 });

  console.log('✅ تم إنشاء شهادة تطوير محلية:');
  console.log(`   المفتاح: ${KEY_PATH}`);
  console.log(`   الشهادة: ${CERT_PATH}`);
  console.log('   التشغيل: HTTPS_ENABLED=true npm run server');
}

main().catch((err) => {
  console.error('❌ تعذر إنشاء الشهادة:', err);
  process.exit(1);
});

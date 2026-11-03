import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('deployment proxy allows base64 QR uploads only on admin support endpoint', () => {
  const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
  assert.match(nginx, /client_max_body_size 32k;/);
  const support = nginx.match(/location = \/api\/admin\/support\s*\{([^}]+)\}/)?.[1];
  assert.ok(support);
  assert.match(support, /client_max_body_size 3m;/);
  assert.match(support, /proxy_pass http:\/\/backend:8000;/);
  assert.match(support, /proxy_set_header Host \$http_host;/);
});

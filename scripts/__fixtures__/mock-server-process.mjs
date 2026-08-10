// scripts/__fixtures__/mock-server-process.mjs
// Test-only launcher: runs startMockServer() in its own OS process (rather than
// in-process inside the test runner) and prints "READY <url>" once listening.
// Kept as a separate process, sibling to the api-client.mjs child the e2e test
// spawns, so both talk over loopback as peers.
import { startMockServer } from './mock-server.mjs';

const routes = JSON.parse(process.argv[2]);
const server = await startMockServer(routes);
process.stdout.write(`READY ${server.url}\n`);

process.on('message', (msg) => {
  if (msg === 'shutdown') {
    server.close().then(() => process.exit(0));
  }
});

process.stdin.resume();
process.stdin.on('data', (data) => {
  if (data.toString().trim() === 'shutdown') {
    server.close().then(() => process.exit(0));
  }
});

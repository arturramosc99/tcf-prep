// Tiny HTTP server for unit tests: records "METHOD path" of every request.
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type Stub = { url: string; paths: string[]; close: () => void };

export async function startStub(handler: http.RequestListener): Promise<Stub> {
  const paths: string[] = [];
  const server = http.createServer((req, res) => {
    paths.push(`${req.method} ${req.url}`);
    handler(req, res);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, paths, close: () => server.close() };
}

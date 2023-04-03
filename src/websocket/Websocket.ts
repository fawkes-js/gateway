import { pack as erlpackpack, unpack as erlpackunpack } from "erlpack";
import { WebSocket } from "ws";

export function pack(data: any) {
  return erlpackpack(data);
}

export function unpack(data: Buffer) {
  if (!Buffer.isBuffer(data)) data = Buffer.from(new Uint8Array(data));
  return erlpackunpack(data);
}

export function createWebSocket(gateway: string, query: any = {}) {
  query.encoding = "etf";
  query = new URLSearchParams(query);
  console.log(`Websocket: ${gateway}?${query}`)
  return new WebSocket(`${gateway}?${query}`);
}

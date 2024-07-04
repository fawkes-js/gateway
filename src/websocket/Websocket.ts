import { WebSocket } from "ws";
import type { GatewayPayload } from "./Shard";

export function pack(data: object): string {
  return JSON.stringify(data);
}

export function unpack(data: string): GatewayPayload {
  // if (!Buffer.isBuffer(data)) data = Buffer.from(new Uint8Array(data));
  return JSON.parse(data);
}

export function createWebSocket(gateway: string, query: any = {}): WebSocket {
  query.encoding = "json";
  query = new URLSearchParams(query);
  return new WebSocket(`${gateway}?${<string>query}`);
}

import { pack as erlpackpack, unpack as erlpackunpack } from 'erlpack'
import { WebSocket } from 'ws'
import type { GatewayPayload } from './Shard'

export function pack (data: any): Buffer {
  return erlpackpack(data)
}

export function unpack (data: Buffer): GatewayPayload {
  if (!Buffer.isBuffer(data)) data = Buffer.from(new Uint8Array(data))
  return erlpackunpack(data)
}

export function createWebSocket (gateway: string, query: any = {}): WebSocket {
  query.encoding = 'etf'
  query = new URLSearchParams(query)
  console.log('the query:', query)
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  console.log(`Websocket: ${gateway}?${query}`)
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return new WebSocket(`${gateway}?${query}`)
}

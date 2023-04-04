import { REST, type RESTOptions } from '@fawkes.js/rest'
import { MessageClient } from './messaging/MessageClient'
import { defaultClientOptions, mergeOptions } from './utils/Options'
import { ShardManager } from './websocket/ShardManager'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { type RabbitOptions, type REDISOptions } from '@fawkes.js/api-types'
import { RedisClient } from './messaging/RedisClient'

export interface GatewayOptions {
  intents: any[]
  token: string
  redis: REDISOptions
  rabbit: RabbitOptions
  rest?: RESTOptions
  ws?: {
    version: number
  }
  shards: number
}

export class Gateway {
  ws: ShardManager
  token: string
  options: any
  rest: REST
  totalShards: number
  cache: RedisClient
  messageClient: MessageClient

  constructor (options: GatewayOptions) {
    this.options = mergeOptions([defaultClientOptions, options])

    this.token = options.token

    this.rest = new REST(mergeOptions([this.options.rest, { redis: this.options.redis }, { token: this.options.token }]) as RESTOptions)

    this.ws = new ShardManager(this)

    this.messageClient = new MessageClient(this)

    this.cache = new RedisClient(this)

    this.totalShards = options.shards
  }

  login (): void {
    void this.rest.connect()
    void this.cache.connect()
    void this.messageClient.connect()
    void this.ws.connect()
  }
}

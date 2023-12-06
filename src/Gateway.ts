import { REST } from "@fawkes.js/rest";
import { RabbitMQMessageClient } from "./messaging/RabbitMQMessageClient";
import { defaultGatewayOptions, defaultRESTOptions, mergeOptions } from "./utils/Options";
import { ShardManager } from "./websocket/ShardManager";
import { Events, type RabbitOptions } from "@fawkes.js/typings";
import { EventEmitter } from "node:events";
import { type REDISOptions, RedisClient, LocalClient } from "@fawkes.js/cache";
import { LocalMessageClient } from "./messaging/LocalMessageClient";
interface RESTGatewayOptions {
  api?: string;
  version?: string;
  tokenType?: string;
}

interface WebsocketOptions {
  version: number;
}
export interface GatewayOptions {
  intents: any[];
  token: string;
  redis?: REDISOptions;
  rabbit?: RabbitOptions;
  rest?: RESTGatewayOptions;
  ws?: WebsocketOptions;
  shards?: number | "auto" | { shards: number[]; totalShards: number };
}

export class Gateway extends EventEmitter {
  ws: ShardManager;
  token: string;
  options: any;
  rest: REST;
  sharding: "auto" | number | { shards: number[]; totalShards: number };
  cache: RedisClient | LocalClient;
  messageClient: RabbitMQMessageClient | LocalMessageClient;

  constructor(options: GatewayOptions) {
    super();
    this.options = mergeOptions([
      defaultGatewayOptions,
      {
        rest: mergeOptions([
          defaultRESTOptions,
          { redis: options.redis },
          options.rest != null ? options.rest : {},
          { discord: { token: options.token } },
        ]),
      },
      { intents: options.intents },
      { redis: options.redis },
      { rabbit: options.rabbit },
      { rest: options.rest },
      { ws: options.ws },
      { shards: options.shards },
      { discord: { token: options.token } },
    ]);

    this.token = options.token;

    // mergeOptions([
    //   this.options.rest,
    //   { redis: this.options.redis },
    //   { token: this.options.token },
    // ]) as RESTOptions

    this.ws = new ShardManager(this);

    this.messageClient = this.options.rabbit ? new RabbitMQMessageClient(this) : new LocalMessageClient(this);

    this.cache = options.redis ? new RedisClient(options.redis) : new LocalClient();

    this.rest = new REST(
      mergeOptions([
        defaultRESTOptions,
        { redis: options.redis },
        options.rest != null ? options.rest : {},
        { discord: { token: options.token } },
      ]),
      this.cache
    );

    this.sharding = options.shards ?? "auto";
  }

  async login(): Promise<void> {
    // prettier-ignore
    this.emit(Events.Debug, `[Gateway] => Login invoked, Token Provided: ${this.token.slice(0, 20)}**********************************`);

    await this.cache.init();
    await this.messageClient.connect();
    await this.ws.connect();
  }
}

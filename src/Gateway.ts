import { REST } from "@fawkes.js/rest";
import { MessageClient } from "./messaging/MessageClient";
import { defaultGatewayOptions, defaultRESTOptions, mergeOptions } from "./utils/Options";
import { ShardManager } from "./websocket/ShardManager";
import { Events, type RabbitOptions, type REDISOptions } from "@fawkes.js/typings";
import { RedisClient } from "./messaging/RedisClient";
import { EventEmitter } from "node:events";

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
  redis: REDISOptions;
  rabbit: RabbitOptions;
  rest?: RESTGatewayOptions;
  ws?: WebsocketOptions;
  shards: number;
}

export class Gateway extends EventEmitter {
  ws: ShardManager;
  token: string;
  options: any;
  rest: REST;
  totalShards: number;
  cache: RedisClient;
  messageClient: MessageClient;

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

    this.rest = new REST(
      mergeOptions([
        defaultRESTOptions,
        { redis: options.redis },
        options.rest != null ? options.rest : {},
        { discord: { token: options.token } },
      ])
    );
    // mergeOptions([
    //   this.options.rest,
    //   { redis: this.options.redis },
    //   { token: this.options.token },
    // ]) as RESTOptions

    this.ws = new ShardManager(this);

    this.messageClient = new MessageClient(this);

    this.cache = new RedisClient(this);

    this.totalShards = options.shards;
  }

  login(): void {
    // prettier-ignore
    this.emit(Events.Debug, `[Gateway] => Login invoked, Token Provided: ${this.token.slice(0, 20)}**********************************`);

    void this.rest.initialise();
    void this.cache.connect();
    void this.messageClient.connect();
    void this.ws.connect();
  }
}

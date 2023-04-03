import { REST, RESTOptions } from "@fawkes.js/rest";
import { MessageClient } from "./messaging/MessageClient";
import { defaultClientOptions, mergeOptions } from "./utils/Options";
import { ShardManager } from "./websocket/ShardManager";
import { RabbitOptions, REDISOptions } from "@fawkes.js/api-types";
import { RedisClient } from "./messaging/RedisClient";

export type GatewayOptions = {
  intents: any[];
  token: string;
  redis: REDISOptions;
  rabbit: RabbitOptions;
  rest?: RESTOptions;
  ws?: {
    version: number;
  };
  shards?: number | "auto";
};

export class Gateway {
  ws: ShardManager;
  token: string;
  options: any;
  rest: REST;
  totalShards!: number | null | "auto" | undefined;
  cache: RedisClient;
  messageClient: MessageClient;

  constructor(options: GatewayOptions) {
    this.options = mergeOptions([defaultClientOptions, options]);

    this.token = options.token;

    this.rest = new REST(<RESTOptions>mergeOptions([this.options.rest, { redis: this.options.redis }, { token: this.options.token }]));

    this.ws = new ShardManager(this);

    this.messageClient = new MessageClient(this);

    this.cache = new RedisClient(this);


    this.totalShards = options.shards
  }

  login() {
    this.rest.connect();
    this.cache.connect();
    this.messageClient.connect()
    this.ws.connect();
  }
}

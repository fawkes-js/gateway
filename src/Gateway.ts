import { REST, type RESTOptions } from '@fawkes.js/rest';
import { MessageClient } from './messaging/MessageClient';
import { mergeOptions } from './utils/Options';
import { ShardManager } from './websocket/ShardManager';
import { type RabbitOptions, type REDISOptions } from '@fawkes.js/api-types';
import { RedisClient } from './messaging/RedisClient';

export interface GatewayOptions {
  intents: any[];
  token: string;
  redis: REDISOptions;
  rabbit: RabbitOptions;
  rest: RESTOptions;
  ws?: {
    version: number;
  };
  shards: number;
}

export class Gateway {
  ws: ShardManager;
  token: string;
  options: any;
  rest: REST;
  totalShards: number;
  cache: RedisClient;
  messageClient: MessageClient;

  constructor(options: GatewayOptions) {
    this.options = options;

    this.token = options.token;

    this.rest = new REST(options.rest);
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
    void this.rest.initialise();
    void this.cache.connect();
    void this.messageClient.connect();
    void this.ws.connect();
  }
}

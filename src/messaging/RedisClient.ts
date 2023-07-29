import { createClient, type RedisClientType } from "redis";
import { type Gateway } from "../Gateway";
import { type DiscordAPIGuild, type REDISOptions } from "@fawkes.js/typings";
import { EventEmitter } from "node:events";

export class RedisClient extends EventEmitter {
  client: Gateway;
  options: REDISOptions;
  cache!: RedisClientType;
  constructor(client: Gateway) {
    super();

    this.options = client.options.redis;

    this.client = client;

    Object.defineProperty(this, "cache", { value: null, writable: true });
    Object.defineProperty(this, "subscriber", { value: null, writable: true });
  }

  async connect(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    const url = this.options.url
      ? this.options.url
      : // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `redis://${this.options.username}:${this.options.password}@${this.options.hostname}:${this.options.port}`;

    this.cache = createClient({ url });

    await this.cache.connect();
  }

  async get(id: string): Promise<any> {
    return JSON.parse(<string>await this.cache.get(id));
  }

  async set(id: string, data: any): Promise<any> {
    return await this.cache.set(id, JSON.stringify(data));
  }

  async delete(id: string): Promise<any> {
    const key = `guild:${id}`;
    return await this.cache.del(key);
  }

  async has(id: string): Promise<any> {
    const key = `guild:${id}`;
    return await this.cache.get(key);
  }

  async patch(id: string, data: DiscordAPIGuild): Promise<any> {
    const key = `guild:${id}`;

    return await this.cache.set(key, JSON.stringify(data));
  }
}

import { Events, Routes } from "@fawkes.js/typings";
import { type Gateway } from "../Gateway";
import { Shard } from "./Shard";
import { EventEmitter } from "node:events";

interface ShardQueue {
  queue: Shard[];
  timer: any;
  time: 8000;
  remaining: number;
  total: number;
}
export class ShardManager extends EventEmitter {
  client: Gateway;
  shards: Shard[];
  gateway!: string;
  max_concurrency!: number;
  shardQueue: ShardQueue;
  constructor(client: Gateway) {
    super();

    this.client = client;

    this.shards = [];

    Object.defineProperty(this, "gateway", { value: null, writable: true });

    Object.defineProperty(this, "max_concurrency", {
      value: null,
      writable: true,
    });

    this.shardQueue = {
      queue: [],
      timer: null,
      time: 8000,
      remaining: 16,
      total: 1,
    };
  }

  async connect(): Promise<void> {
    const data = await this.client.rest
      .request(Routes.gatewayBot())
      .then((res) => {
        return res;
      })
      .catch((err) => {
        console.log(err);
      });

    // prettier-ignore
    this.client.emit(Events.Debug,`[Gateway - Shard Manager] => Received Gateway Information\n\tGateway URL: ${<string>data.url}\n\tRecommended Shards: ${<string>(data.shards)}`);

    this.gateway = data.url;
    this.max_concurrency = data.session_start_limit.max_concurrency;
    this.shardQueue.total = data.session_start_limit.max_concurrency;

    if (this.client.totalShards === null || this.client.totalShards === undefined || typeof this.client.totalShards !== "number")
      this.client.totalShards = data.shards;

    this.client.emit(Events.Debug, `[Gateway - Shard Manager] => Total Shards: ${this.client.totalShards}`);

    for (let id = 0; id < this.client.totalShards; id++) {
      this.client.emit(Events.Debug, `[Gateway - Shard Manager] => Shard Created, Shard ID: ${id}`);

      const shard = new Shard(id, this, this.client);
      this.shardQueue.queue.push(shard);
      shard.on("ShardReconnect", () => {
        void (async (shard: Shard): Promise<void> => {
          await shard.connect();
        });
      });
    }
    await this.manageQueue();
  }

  async manageQueue(): Promise<void> {
    if (this.shardQueue.queue.length === 0) return;
    if (this.shardQueue.remaining < 1) return;
    if (this.shardQueue.remaining === this.shardQueue.total) {
      setTimeout(() => {
        void (async () => {
          this.shardQueue.remaining = this.shardQueue.total;
          await this.manageQueue();
        });
      }, this.shardQueue.time);
    }

    while (this.shardQueue.remaining > 0 && this.shardQueue.queue.length > 0) {
      const shard = this.shardQueue.queue.shift();
      if (!shard) return;

      this.shards.push(shard);
      this.shardQueue.remaining--;

      await shard.connect();
    }
  }
}

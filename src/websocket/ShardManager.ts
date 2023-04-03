import { Routes } from "@fawkes.js/api-types";
import { BaseClass } from "../BaseClass";
import { Gateway } from "../Gateway";
import { Shard } from "./Shard";

type ShardQueue = {
  queue: Shard[];
  timer: any;
  time: 8000;
  remaining: number;
  total: number;
};
export class ShardManager extends BaseClass {
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

    Object.defineProperty(this, "max_concurrency", { value: null, writable: true });

    this.shardQueue = {
      queue: [],
      timer: null,
      time: 8000,
      remaining: 16,
      total: 1,
    };
  }

  async connect() {
    const data = await this.client.rest
      .request(Routes.gatewayBot())
      .then((res) => {
        return res;
      })
      .catch((err) => {
        console.log(err);
      });

    this.gateway = data.url;
    this.max_concurrency = data.session_start_limit.max_concurrency;
    this.shardQueue.total = data.session_start_limit.max_concurrency;

    if (!this.client.totalShards || typeof (this.client.totalShards) !== 'number') this.client.totalShards === data.shards

    for (let id = 0; id < <number>this.client.totalShards; id++) {
      const shard = new Shard(id, this, this.client);
      this.shardQueue.queue.push(shard);
      shard.on("ShardReconnect", (shard: Shard) => {
        shard.connect();
      });
    }
    this.manageQueue();
  }

  manageQueue() {
    if (this.shardQueue.queue.length === 0) return;
    if (this.shardQueue.remaining < 1) return;
    if ((this.shardQueue.remaining = this.shardQueue.total)) {
      setTimeout(() => {
        this.shardQueue.remaining = this.shardQueue.total;
        this.manageQueue();
      }, this.shardQueue.time);
    }

    while (this.shardQueue.remaining > 0 && this.shardQueue.queue.length > 0) {
      const shard = this.shardQueue.queue.shift();
      this.shards.push(<Shard>shard);
      this.shardQueue.remaining--;

      shard?.connect();
    }
  }
}

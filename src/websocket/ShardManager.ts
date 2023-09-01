/* eslint-disable @typescript-eslint/no-misused-promises */
import { Events, Routes } from "@fawkes.js/typings";
import { type Gateway } from "../Gateway";
import { Shard } from "./Shard";
import { EventEmitter } from "node:events";

interface ShardQueue {
  queue: Shard[];
  timer: any;
  time: 8000;
  total: number | null;
}
export class ShardManager extends EventEmitter {
  client: Gateway;
  shards: Shard[];
  gateway!: string;
  shardQueue: ShardQueue;
  totalShards: number;
  constructor(client: Gateway) {
    super();

    this.client = client;

    this.shards = [];

    Object.defineProperty(this, "gateway", { value: null, writable: true });

    Object.defineProperty(this, "totalShards", { value: null, writable: true });

    this.shardQueue = {
      queue: [],
      timer: null,
      time: 8000,
      total: null,
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

    // this.client.cache.set("gateway:maxConcurrency");

    this.shardQueue.total = data.session_start_limit.max_concurrency;

    await this.client.cache.set("gateway:maxConcurrencyTotal", data.session_start_limit.max_concurrency);

    if (this.client.sharding === "auto" || this.client.sharding === null || this.client.sharding === undefined)
      this.totalShards = <number>data.shards;
    else if (typeof this.client.sharding === "object")
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.totalShards = <{ shards: number[]; totalShards: number }>(<unknown>this.client.sharding.totalShards);
    else if (typeof this.client.sharding === "number") this.totalShards = this.client.sharding;

    this.client.emit(Events.Debug, `[Gateway - Shard Manager] => Total Shards: ${this.totalShards}`);

    const deployShard = (id: number): void => {
      this.client.emit(Events.Debug, `[Gateway - Shard Manager] => Shard Created, Shard ID: ${id}`);

      const shard = new Shard(id, this, this.client);
      this.shardQueue.queue.push(shard);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      shard.on("ShardReconnect", async () => {
        this.shardQueue.queue.unshift(shard);
        await this.manageQueue();
      });
    };

    if (typeof this.client.sharding === "object")
      this.client.sharding.shards.forEach((id) => {
        deployShard(id);
      });
    else
      for (let id = 0; id < this.totalShards; id++) {
        deployShard(id);
      }
    await this.manageQueue();
  }

  async manageQueue(): Promise<void> {
    if (this.shardQueue.queue.length === 0) return;
    const remaining = await this.client.cache.get("gateway:maxConcurrencyRemaining");
    const expiry = (await this.client.cache.cache.ttl("gateway:maxConcurrencyRemaining")) * 1000;
    if (remaining < 1 && remaining !== null && expiry > 0 && !this.shardQueue.timer) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.shardQueue.timer = setTimeout(async () => {
        this.shardQueue.timer = null;
        await this.manageQueue();
      }, expiry);
      return;
    } else if (this.shardQueue.timer) return;

    const updateRemaining = async (): Promise<void> => {
      await this.client.cache.cache.watch("gateway:maxConcurrencyRemaining");
      const multi = this.client.cache.cache.multi();

      const remaining = await this.client.cache.cache.get("gateway:maxConcurrencyRemaining");

      if (remaining === null) {
        multi.set("gateway:maxConcurrencyRemaining", <number>this.shardQueue.total - 1, { EX: 8 });
        // PROCEED AND CREATE THE SHARD
      } else if (Number(remaining) <= 0) {
        // SET A TIMEOUT USING THE KEY'S EXPIRY, AND THEN TRY AGAIN WHEN TIMEOUT DONE

        if (this.shardQueue.timer) return;
        else {
          this.shardQueue.timer = setTimeout(() => {
            this.shardQueue.timer = null;
            void this.manageQueue();
          }, (await this.client.cache.cache.ttl("gateway:maxConcurrencyRemaining")) * 1000);
          return;
        }
      } else if (Number(remaining) > 0) {
        multi.set("gateway:maxConcurrencyRemaining", <number>this.shardQueue.total - 1, { EX: 8 });
        // PROCEED AND CREATE THE SHARD
      }

      try {
        await multi.exec();

        const shard = this.shardQueue.queue.shift();
        if (!shard) return;

        this.shards.push(shard);

        await shard.connect();

        void this.manageQueue();
      } catch (err) {
        if (!expiry) {
          await updateRemaining();
        } else {
          setTimeout(async () => {
            await updateRemaining();
          }, (await this.client.cache.cache.ttl("gateway:maxConcurrencyRemaining")) * 1000);
        }
      }
    };
    await updateRemaining();
  }
}

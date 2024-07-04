import { Events, GatewayCloseEventCodes, GatewayOpcodes } from "@fawkes.js/typings";
import { createWebSocket, pack, unpack } from "./Websocket";
import { type WebSocket, type CloseEvent, type MessageEvent } from "ws";
import { type Gateway } from "../Gateway";
import { type ShardManager } from "./ShardManager";
import { FawkesError } from "../errors/FawkesError";
import { EventEmitter } from "node:events";

export interface GatewayPayload {
  op: number;
  d?: any;
  s?: number;
  t?: string;
}

interface WebSocketPayload {
  important: boolean;
  data: GatewayPayload;
}

interface RateLimitData {
  queue: WebSocketPayload[];
  timer: any;
  total: 120;
  remaining: number;
  time: 60000;
}

export class Shard extends EventEmitter {
  client: Gateway;
  ws!: WebSocket | null;
  sequence: null | number;
  heartbeatInterval!: NodeJS.Timer;
  lastHeartbeatAcknowledged: boolean;
  sessionId!: string;
  gateway!: string;
  ratelimit: RateLimitData;
  manager: ShardManager;
  id: number;
  state!: null | "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED";
  constructor(id: number, manager: ShardManager, client: Gateway) {
    super();

    this.client = client;

    this.manager = manager;

    this.id = id;

    this.gateway = manager.gateway;

    Object.defineProperty(this, "ws", { value: null, writable: true });

    Object.defineProperty(this, "sessionId", { value: null, writable: true });

    this.lastHeartbeatAcknowledged = true;

    this.sequence = null;

    Object.defineProperty(this, "heartbeatInterval", {
      value: null,
      writable: true,
    });

    Object.defineProperty(this, "state", { value: null, writable: true });

    this.ratelimit = {
      queue: [],
      total: 120,
      remaining: 120,
      timer: null,
      time: 60000,
    };
  }

  onMessage(data: MessageEvent): void {
    const message: GatewayPayload = unpack(<string>data.data);
    if (message.s !== null && this.sequence !== null) {
      if (<number>message.s > this.sequence) this.sequence = <number>message.s;
    }

    // prettier-ignore
    this.client.emit(Events.Debug, `[Gateway - Shard ${this.id}] => Message Received, \x1b[1mOpcode:\x1b[0m ${message.op} (${GatewayOpcodes[message.op]}), \x1b[1mEvent Name:\x1b[0m ${<string>message.t}, \x1b[1mSequence:\x1b[0m ${<number>message.s}`,Date.now());

    switch (message.op) {
      case GatewayOpcodes.Dispatch:
        if (message.t === "READY") {
          if (this.sessionId === null) this.sessionId = message.d.session_id;
          this.client.messageClient.publishPrimary(message);
        } else if (message.t === "INTERACTION_CREATE") {
          if (message.d.type === 3 || message.d.type === 4 || message.d.type === 5) {
            void this.client.messageClient.publishSecondary(message);
          } else {
            this.client.messageClient.publishPrimary(message);
          }
        } else {
          this.client.messageClient.publishPrimary(message);
        }
        break;

      case GatewayOpcodes.Heartbeat:
        break;

      case GatewayOpcodes.Reconnnect:
        this.resume();
        console.log(message);
        break;

      case GatewayOpcodes.InvalidSession:
        this.resume(message.d);
        console.log(message);
        break;

      case GatewayOpcodes.Hello:
        this.sendHeartbeat();
        this.startHeartbeats(message.d.heartbeat_interval);
        this.identify();
        break;

      case GatewayOpcodes.HeartbeatACK:
        this.acknowledgedHeartbeat();
        break;
    }
  }

  onClose(event: CloseEvent): void {
    switch (event.code) {
      case GatewayCloseEventCodes.UnknownError:
        break;

      case GatewayCloseEventCodes.UnknownOpcode:
        this.resume();
        break;

      case GatewayCloseEventCodes.DecodeError:
        this.resume();
        break;

      case GatewayCloseEventCodes.NotAuthenticated:
        this.resume();

        break;

      case GatewayCloseEventCodes.AuthenticationFailed:
        throw new FawkesError("Authentication Failed", "An invalid token was provided.");

      case GatewayCloseEventCodes.AlreadyAuthenticated:
        break;

      case GatewayCloseEventCodes.InvalidSequence:
        break;

      case GatewayCloseEventCodes.RateLimited:
        this.resume();
        break;

      case GatewayCloseEventCodes.SessionTimedOut:
        break;

      case GatewayCloseEventCodes.InvalidShard:
        throw new FawkesError("Invalid Shard", "The shard provided was invalid.");

      case GatewayCloseEventCodes.ShardingRequired:
        throw new FawkesError(
          "Sharding Required",
          "This connection requires sharding, however this has not been enabled - ensure you have provided enough shards, or make use of the recommended shard count."
        );

      case GatewayCloseEventCodes.InvalidAPIVersion:
        throw new FawkesError(
          "Invalid API Version",
          "The API version provided is invalid - consider using the latest version (version 10)."
        );

      case GatewayCloseEventCodes.InvalidIntents:
        throw new FawkesError(
          "Invalid Intents",
          "The intents provided were invalid - ensure you are using the correct flags or values."
        );

      case GatewayCloseEventCodes.DisallowedIntents:
        throw new FawkesError(
          "Disallowed Intents",
          "The intents provided were not allowed - check the discord developer portal to ensure that your provided intents are approved."
        );
    }
  }

  acknowledgedHeartbeat(): void {
    this.lastHeartbeatAcknowledged = true;
  }

  processQueue(): void {
    if (this.ratelimit.queue.length < 1) return;
    if (this.ratelimit.remaining < 1) return;
    if (this.ratelimit.remaining === this.ratelimit.total) {
      setTimeout(() => {
        this.ratelimit.remaining = 120;
        this.processQueue();
      }, this.ratelimit.time);
    }

    while (
      (this.ratelimit.remaining > 5 || (this.ratelimit.queue[0]?.important && this.ratelimit.remaining > 0)) &&
      this.ratelimit.queue.length > 0
    ) {
      const item = this.ratelimit.queue.shift();
      if (item == null) return;
      this.ws?.send(pack(item.data));
      this.ratelimit.remaining--;
      this.processQueue();
    }
  }

  send(data: WebSocketPayload): void {
    this.ratelimit.queue[data.important ? "unshift" : "push"](data);
    this.processQueue();
  }

  resume(d?: any | null): void {
    if (d) if (d.d === false) this.sessionId = "";
    this.emit("ShardReconnect", this);
  }

  sendHeartbeat(): void {
    if (!this.lastHeartbeatAcknowledged) this.resume(); // Zombied Connection
    else if (this.lastHeartbeatAcknowledged) {
      this.send({
        important: true,
        data: {
          op: GatewayOpcodes.Heartbeat,
          d: this.sequence,
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.sequence! += 1;
  }

  startHeartbeats(interval: number): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  identify(): void {
    this.sessionId !== null ? this.identifyResume() : this.identifyNew();
  }

  identifyNew(): void {
    let intents: number = 0;
    this.client.options.intents.map((intent: number) => (intents += intent));
    this.send({
      important: true,
      data: {
        op: GatewayOpcodes.Identify,
        d: {
          token: this.client.token,
          intents,
          properties: {
            os: "linux",
            browser: "fawkes.js",
            device: "fawkes.js",
            version: this.client.options.ws.version,
          },
          compression: false,
          shard: [this.id, this.manager.totalShards],
        },
      },
    });
    this.sendHeartbeat();
  }

  identifyResume(): void {
    this.ws?.send(
      pack({
        op: 6,
        d: {
          token: this.client.token,
          session_id: this.sessionId,
          seq: this.sequence,
        },
      })
    );
  }

  async connect(): Promise<void> {
    this.client.emit(Events.Debug, `[Gateway - Shard ${this.id}] => Shard Connection Invoked, Shard ID: ${this.id}`);

    this.ws = createWebSocket(`${this.manager.gateway}`, {
      v: this.client.options.ws.version,
    });
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onclose = this.onClose.bind(this);
  }
}

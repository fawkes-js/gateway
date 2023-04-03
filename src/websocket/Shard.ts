import { GatewayCloseEventCodes, GatewayOpcodes } from "@fawkes.js/api-types";
import { createWebSocket, pack, unpack } from "./Websocket";
import { WebSocket, CloseEvent, MessageEvent } from "ws";
import { Gateway } from "../Gateway";
import { BaseClass } from "../BaseClass";
import { ShardManager } from "./ShardManager";
import { FawkesError } from "../errors/FawkesError";
type GatewayPayload = {
  op: number;
  d?: any;
  s?: number;
  t?: string;
};

type WebSocketPayload = {
  important: boolean;
  data: GatewayPayload;
};

type RateLimitData = {
  queue: WebSocketPayload[];
  timer: any;
  total: 120;
  remaining: number;
  time: 60000;
};

export class Shard extends BaseClass {
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

    Object.defineProperty(this, "heartbeatInterval", { value: null, writable: true });

    Object.defineProperty(this, "state", { value: null, writable: true });

    this.ratelimit = {
      queue: [],
      total: 120,
      remaining: 120,
      timer: null,
      time: 60000,
    };
  }
  onClose(event: CloseEvent) {
    switch (event.code) {
      case GatewayCloseEventCodes.UnknownError:
        this.debug({ title: "Gateway Close", value: "Unknown Error Close Code" });
        break;

      case GatewayCloseEventCodes.UnknownOpcode:
        this.debug({ title: "Gateway Close", value: "Unknown Opcode Close Code" });
        this.resume();
        break;

      case GatewayCloseEventCodes.DecodeError:
        this.debug({ title: "Gateway Close", value: "Unknown Error Close Code" });
        this.resume();
        break;

      case GatewayCloseEventCodes.NotAuthenticated:
        this.resume();
        this.debug({ title: "Gateway Close", value: "Not Authenticated Close Code" });
        break;

      case GatewayCloseEventCodes.AuthenticationFailed:
        this.debug({ title: "Gateway Close", value: "Authentication Failed Close Code" });
        throw new FawkesError("Authentication Failed", "An invalid token was provided.");
        break;

      case GatewayCloseEventCodes.AlreadyAuthenticated:
        this.debug({ title: "Gateway Close", value: "Already Authenticated Close Code" });
        break;

      case GatewayCloseEventCodes.InvalidSequence:
        this.debug({ title: "Gateway Close", value: "Invalid Sequence Close Code" });
        break;

      case GatewayCloseEventCodes.RateLimited:
        this.debug({ title: "Gateway Close", value: "Rate Limited Close Code" });
        this.resume();
        break;

      case GatewayCloseEventCodes.SessionTimedOut:
        this.debug({ title: "Gateway Close", value: "Session Timed Out Close Code" });
        break;

      case GatewayCloseEventCodes.InvalidShard:
        this.debug({ title: "Gateway Close", value: "Invalid Shard Close Code" });
        break;

      case GatewayCloseEventCodes.ShardingRequired:
        this.debug({ title: "Gateway Close", value: "Sharding Required Close Code" });
        break;

      case GatewayCloseEventCodes.InvalidAPIVersion:
        this.debug({ title: "Gateway Close", value: "Invalid API Version Close Code" });
        break;

      case GatewayCloseEventCodes.InvalidIntents:
        this.debug({ title: "Gateway Close", value: "Invalid Intents Close Code" });
        break;

      case GatewayCloseEventCodes.DisallowedIntents:
        this.debug({ title: "Gateway Close", value: "Disallowed Intents Close Code" });
        break;
    }
  }
  acknowledgedHeartbeat() {
    this.lastHeartbeatAcknowledged = true;
  }

  processQueue() {
    if (this.ratelimit.queue.length < 1) return;
    if (this.ratelimit.remaining < 1) return;
    if (this.ratelimit.remaining === this.ratelimit.total) {
      setTimeout(() => {
        this.ratelimit.remaining = 120;
        this.processQueue();
      }, this.ratelimit.time);
    }

    while (
      (this.ratelimit.remaining > 5 || (this.ratelimit.queue[0]?.important === true && this.ratelimit.remaining > 0)) &&
      this.ratelimit.queue.length > 0
    ) {
      const item = this.ratelimit.queue.shift();
      if (!item) return;
      this.ws?.send(pack(item.data));
      this.ratelimit.remaining--;
      this.processQueue();
    }
  }
  send(data: WebSocketPayload) {
    this.ratelimit.queue[data.important ? "unshift" : "push"](data);
    this.processQueue();
  }
  resume(d?: any | null) {
    if (d.d === false) this.sessionId = ''
    this.emit("ShardReconnect", this);
  }

  sendHeartbeat() {
    if (this.lastHeartbeatAcknowledged === false) this.resume(); // Zombied Connection
    else if (this.lastHeartbeatAcknowledged === true)
      this.send({
        important: true,
        data: {
          op: GatewayOpcodes.Heartbeat,
          d: this.sequence,
        },
      });

    this.sequence! += 1;
  }

  startHeartbeats(interval: number) {
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), interval);
  }

  onMessage(data: MessageEvent) {
    const message: GatewayPayload = unpack(<Buffer>(<unknown>data.data));
    if (message.s! > this.sequence!) this.sequence = message.s!;
    if (message.t) {
      if ((message.t === 'INTERACTION_CREATE') && (message.d.type === (3 || 4 || 5))) {
        this.client.messageClient.publishSecondary(message)
      } else
        this.client.messageClient.publishPrimary(message);
    }

    switch (message.t) {
      case "READY":
        this.debug({ title: "Gateway", value: "Ready Event Received," });

        if (!this.sessionId) this.sessionId = message.d.session_id;
        break;
    }

    switch (message.op) {
      case GatewayOpcodes.Dispatch:
        this.debug({ title: "Gateway", value: "Dispatch Event Received," });
        break;

      case GatewayOpcodes.Heartbeat:
        this.debug({ title: "Gateway", value: "Heartbeat Event Received," });
        break;

      case GatewayOpcodes.Reconnnect:
        this.debug({ title: "Gateway", value: "Reconnect Event Received," });
        break;

      case GatewayOpcodes.InvalidSession:
        this.debug({ title: "Gateway", value: "Invalid Session Event Received," });
        this.resume(message.d)
        break;

      case GatewayOpcodes.Hello:
        this.debug({ title: "Gateway", value: "Hello Event Received," });
        this.sendHeartbeat()
        this.startHeartbeats(message.d.heartbeat_interval);
        this.identify();
        break;

      case GatewayOpcodes.HeartbeatACK:
        this.debug({ title: "Gateway", value: `SHARD ${this.id} - Heartbeat Acknowledgement Event Received,` });
        this.acknowledgedHeartbeat();
        break;
    }
  }
  identify() {
    this.sessionId ? this.identifyResume() : this.identifyNew();
  }

  identifyNew() {
    let intents: number = 0;
    this.client.options.intents.map((intent: number) => (intents += intent));
    this.send({
      important: true,
      data: {
        op: GatewayOpcodes.Identify,
        d: {
          token: this.client.token,
          intents: intents,
          properties: {
            os: "linux",
            browser: "fawkes.js",
            device: "fawkes.js",
            version: this.client.options.ws.version,
          },
          compression: false,
          shard: [this.id, this.client.totalShards],
        },
      },
    });
    this.sendHeartbeat();
  }

  identifyResume() {
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
  async connect() {
    this.ws = createWebSocket(`${this.manager.gateway}`, { v: this.client.options.ws.version });
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onclose = this.onClose.bind(this);
  }
}

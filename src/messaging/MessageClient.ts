import { BaseClass } from "../BaseClass";
import type { Gateway } from "../Gateway";
import { connect } from "amqplib/callback_api";

export class MessageClient extends BaseClass {
  client: Gateway;
  connection: any;
  channel: any;
  options: any;
  constructor(client: Gateway) {
    super();

    this.client = client;

    this.options = client.options.rabbit;

    this.connection = null;

    this.channel = null;
  }

  async connect(): Promise<void> {
    // Create a connection with the AMQP Server,
    connect(this.options.hostname, (err, connection) => {
      if (err !== null) {
        console.log("AMQP Error - Error Connecting,");
        return;
      }

      this.connection = connection;

      // Create a channel witin the connection,

      this.channel = this.connection.createChannel((err, channel) => {
        if (err !== null) {
          console.log("AMQP Error - Error creating a channel,");
          return;
        }

        this.channel = channel;

        this.channel.assertQueue("primary", {}, (err: any, q: any) => {
          if (err) {
            console.log("AMQP ERROR - Error asserting queue");
          }
        });

        // Create the exchange if it does not exist, and then bind a temporary channel to it,
        this.channel.assertExchange("secondary", "fanout", { durable: false });

        this.channel.assertQueue("", { exclusive: true }, (err: any, q: any) => {
          if (err) {
            console.log("AMQP ERROR - Error asserting queue");
            return;
          }

          this.channel.bindQueue(q.queue, "secondary", "");
        });
      });
    });
  }

  publishPrimary(message: any): void {
    this.channel.sendToQueue("primary", Buffer.from(JSON.stringify(message)));
  }

  async publishSecondary(message: any): Promise<void> {
    if (message.d.type === 3) {
      const queue = await this.client.cache.get("event:message:" + String(message.d.message.id));

      const data = {
        tag: "event:message" + String(message.d.message.id),
        data: message,
      };
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
    }
  }
}

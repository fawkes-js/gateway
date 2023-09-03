import { type Gateway } from "../Gateway";

export class LocalMessageClient {
  client: Gateway;
  constructor(client: Gateway) {
    this.client = client;
  }

  async connect(): Promise<void> {}

  publishPrimary(message: any): void {
    this.client.emit("publishPrimary", message);
  }

  async publishSecondary(message: any): Promise<void> {
    const data = {
      tag: "event:message:" + String(message.d.message.id),
      data: message.d,
    };
    this.client.emit("publishSecondary", data);
  }
}

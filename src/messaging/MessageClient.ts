import { BaseClass } from '../BaseClass'
import type { Gateway } from '../Gateway'
import { connect } from 'amqplib/'

export class MessageClient extends BaseClass {
  client: Gateway
  connection: any
  channel: any
  options: any
  constructor (client: Gateway) {
    super()

    this.client = client

    this.options = client.options.rabbit

    this.connection = null

    this.channel = null
  }

  async connect (): Promise<void> {
    // Create a connection with the AMQP Server,
    this.connection = await connect(this.options.hostname)

    // Create a channel witin the connection,
    this.channel = await this.connection.createChannel((err: any) => {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (err) {
        console.log('Gateway - RabbitMQ Channel Creation Error')
        return
      }

      // Create the exchange if it does not exist, and then bind a temporary channel to it,
      this.channel.assertExchange('secondary', 'fanout', { durable: false })

      this.channel.assertQueue('', { exclusive: true }, (err, q) => {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (err) {
          console.log('AMQP ERROR - Error asserting queue')
          return
        }

        this.channel.bindQueue(q.queue, 'secondary', '')
      })
    })
  }

  publishPrimary (message: any): void {
    console.log('published')
    this.channel.sendToQueue('primary', Buffer.from(JSON.stringify(message)))
  }

  async publishSecondary (message: any): Promise<void> {
    if (message.d.type === 3) {
      const queue = await this.client.cache.get('event:message:' + String(message.d.message.id))
      console.log(queue)

      const data = { tag: 'event:message' + String(message.d.message.id), data: message }
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)))
    }
  }
}

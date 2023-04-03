import { BaseClass } from "../BaseClass";
import { Gateway } from "../Gateway";
import { connect } from 'amqplib/callback_api'

export class MessageClient extends BaseClass {
    client: Gateway;
    connection: any;
    channel: any;
    options: any;
    constructor(client: Gateway) {
        super();

        this.client = client;

        this.options = client.options.rabbit

        this.connection = null;

        this.channel = null;

    }

    async connect() {

        // Create a connection with the AMQP Server,
        connect(this.options.hostname, (err, connection) => {

            if (err) {
                console.log('AMP CONNECTION ERROR');
                return;
            }
            this.connection = connection


            // Create a channel witin the connection,
            this.channel = connection.createChannel((err, channel) => {
                if (err) {
                    console.log('Gateway - RabbitMQ Channel Creation Error')
                    return;
                }


                // Create the exchange if it does not exist, and then bind a temporary channel to it,
                this.channel.assertExchange('secondary', 'fanout', { durable: false })

                this.channel.assertQueue('', { exclusive: true }, (err, q) => {
                    if (err) {
                        console.log('AMQP ERROR - Error asserting queue');
                        return;
                    }

                    this.channel.bindQueue(q.queue, 'secondary', '',)

                })


            })
        })
    }

    publishPrimary(message: any) {
        this.channel.sendToQueue("primary23", Buffer.from(JSON.stringify(message)))
    }

    async publishSecondary(message: any) {
        if (message.d.type === 3) {
            const queue = await this.client.cache.get('event:message:' + message.d.message.id)
            console.log(queue)

            const data = { tag: 'event:message' + message.d.message.id, data: message }
            this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)))
        }
    }
}

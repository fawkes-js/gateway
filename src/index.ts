import { GatewayIntents } from "@fawkes.js/api-types";
import { Gateway } from "./Gateway";

export * from "./Gateway";

// const gateway = new Gateway({
//     intents: [GatewayIntents.Guilds, GatewayIntents.GuildMembers, GatewayIntents.GuildPresences],
//     token: <string>'MTAxMTM4MDg3NDcxMDg3NjE3MA.GRkpyW.UXqf1VLHxpS9WmhwIv-FuShr_AXz2PFZKYAhzE',
//     redis: { url: "redis://default:redispw@127.0.0.1:55000" },
//     shards: 1
// })

// gateway.login()
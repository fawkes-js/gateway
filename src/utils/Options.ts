import { RESTOptions } from "@fawkes.js/rest";

export function mergeOptions(options: object[]) {
  let value = {};

  options.map((option) => {
    value = { ...value, ...option };
  });
  return value;
}

export type DefaultClientOptions = {
  rest: RESTOptions;
  intents: any[];
  ws: {
    version: number;
  };
  shards: number | "auto";
};
export const defaultRESTOptions: RESTOptions = {
  prefix: "Bot",
  api: "https://discord.com/api",
  version: "10",
  versioned: true,
};
export const defaultClientOptions: DefaultClientOptions = {
  rest: defaultRESTOptions,
  intents: [],
  ws: {
    version: 10,
  },
  shards: "auto",
};

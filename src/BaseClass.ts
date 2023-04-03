import { EventEmitter } from "node:events";

export type DebugData = {
  title: string;
  value: string;
};

export class BaseClass extends EventEmitter {
  constructor() {
    super();
  }

  debug({ title, value }: DebugData) {
    console.log(`\x1b[1m\x1b[36m${title} - \x1b[33m${value}\x1b[0m`);
  }
}

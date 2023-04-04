import { EventEmitter } from 'node:events'

export interface DebugData {
  title: string
  value: string
}

export class BaseClass extends EventEmitter {
  debug ({ title, value }: DebugData): void {
    console.log(`\x1b[1m\x1b[36m${title} - \x1b[33m${value}\x1b[0m`)
  }
}

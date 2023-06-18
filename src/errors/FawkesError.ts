export class FawkesError extends Error {
  code: string;
  description: string;
  constructor(code: string, description: string) {
    super(`\x1b[1m\x1b[91m[${code}]:\x1b[0m \x1b[10\x1b[91m${description}\x1b[0m`);
    this.code = code;
    this.description = description;
  }
}

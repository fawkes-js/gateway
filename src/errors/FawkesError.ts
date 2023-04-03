export class FawkesError extends Error {
  code: string;
  description: string;
  constructor(code: string, description: string) {
    super(`\x1b[1m\x1b[36m[${code}]:\x1b[0m \x1b[1m\x1b[33m${description}\x1b[0m`);
    this.code = code;
    this.description = description;
  }
}

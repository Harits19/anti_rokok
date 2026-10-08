export class Logger {
  private readonly prefix: string;

  constructor(prefix?: Function | string) {
    this.prefix =
      typeof prefix === 'function'
        ? prefix.name
        : prefix ?? '';
  }

  info(message: string, data?: unknown) {
    this.log('INFO', message, data);
  }

  error(message: string, error?: unknown) {
    this.log('ERROR', message, error);
  }

  warn(message: string, data?: unknown) {
    this.log('WARN', message, data);
  }

  private log(level: string, message: string, data?: unknown) {
    const prefix = this.prefix ? `${this.prefix} ` : '';

    const json =
      data !== undefined
        ? `\n${JSON.stringify(data, null, 2)}`
        : '';

    // stderr, bukan stdout: stdout dipakai untuk data (mis. output JSON CLI)
    // dan untuk protokol JSON-RPC di MCP server.
    console.error(`${level} ${prefix}${message}${json}`);
  }
}
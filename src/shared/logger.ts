
export class Logger {
  prefix: string;
  constructor(prefix?: Function) {

    this.prefix = prefix?.name ?? '';
  }

  info(msg: string) {
    console.log(`${this.prefix} ${msg}`);
  }

  error(msg: string, error: unknown) {
    console.error(msg, error)
  }
}



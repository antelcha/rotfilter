export class RequestQueue {
  private running = 0; private tasks: Array<() => void> = [];
  constructor(private readonly concurrency = 3) {}
  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => { this.tasks.push(() => { this.running++; task().then(resolve,reject).finally(() => { this.running--; this.pump(); }); }); this.pump(); });
  }
  private pump() { while (this.running < this.concurrency && this.tasks.length > 0) this.tasks.shift()!(); }
}

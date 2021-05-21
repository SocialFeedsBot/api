// Bucket for rate-limits
// thanks unb :]

module.exports = class Bucket extends Array {

  constructor (limit = 1) {
    super();

    this.processing = false;
    this.limit = limit;
    this.remaining = limit;
    this.reset = null;
  }

  /**
   * Queues a request.
   * @param request {function}
   */
  queue (request) {
    this.push(request);
    if (!this.processing) {
      this.processing = true;
      this.execute();
    }
  }

  /**
   * Executes the queue.
   */
  execute () {
    if (!this.length) {
      clearTimeout(this.processing);
      this.processing = false;
      return;
    }

    const now = Date.now();
    if (!this.reset || this.reset < now) {
      this.reset = now;
      this.remaining = this.limit;
    }

    if (this.remaining <= 0) {
      this.processing = setTimeout(() => {
        this.processing = false;
        this.execute();
      }, Math.max(0, (this.reset || 0) - now) + 1);
      return;
    }

    --this.remaining;
    this.shift()(() => this.execute());
  }

};

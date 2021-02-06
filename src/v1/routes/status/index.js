const Base = require('../../../structures/Route');

module.exports = class Status extends Base {

  constructor() {
    super();

    this.register('get', '/', this.get.bind(this));
  }

  /**
   * GET the status route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async get(req, res) {
    if (req.app.locals.gw.connected) {
      const shards = await req.app.locals.gw.request(
        { name: 'cluster', id: 'all' },
        `this.shards.map(s => ({
          uptime: this.uptime,
          id: s.id,
          cluster: this.clusterID,
          status: s.status,
          guilds: this.guilds.filter(g => g.shard.id === s.id).length
         }));`);
      const feeds = await req.app.locals.gw.request({ name: 'feeds' }, `({
        uptime: Date.now() - this.startedAt,
        memory: process.memoryUsage().heapUsed
      })`);
      const api = await req.app.locals.gw.request({ name: 'api' }, `({
        uptime: process.uptime() * 1000,
        memory: process.memoryUsage().heapUsed
      })`);

      res.status(200).json({ shards: shards.flat(), feeds: feeds[0], api: api[0] });
    } else {
      res.status(200).json({ shards: [], feeds: { uptime: 0 }, api: { uptime: 0 } });
    }
  }

};

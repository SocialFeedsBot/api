const Base = require('../../../structures/Route');

module.exports = class Status extends Base {

  constructor() {
    super();

    this.register('get', '/', this.get.bind(this));
    this.register('get', '/services', this.services.bind(this));
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
          memory: process.memoryUsage().heapUsed,
          id: s.id,
          cluster: this.clusterID,
          status: s.status,
          guilds: this.guilds.filter(g => g.shard.id === s.id).length
         }));`);
      const feeds = await req.app.locals.gw.request({ name: 'feeds' }, `({
        uptime: Date.now() - this.startedAt,
        memory: process.memoryUsage().heapUsed
      })`);
      const interactions = await req.app.locals.gw.request({ name: 'interactions', id: 'all' }, `({
        uptime: Date.now() - this.startedAt,
        memory: process.memoryUsage().heapUsed,
        id: this.id
      })`);
      console.log(interactions)
      const api = await req.app.locals.gw.request({ name: 'api' }, `({
        uptime: Date.now() - app.startedAt,
        memory: process.memoryUsage().heapUsed
      })`);

      res.status(200).json({ shards: shards.flat(), interactions, feeds: feeds, api: api[0] });
    } else {
      res.status(200).json({ shards: [], feeds: { uptime: 0 }, api: { uptime: 0 } });
    }
  }

  /**
   * GET the service list route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async services(req, res) {
    if (req.app.locals.gw.connected) {
      const services = await req.app.locals.gw.request(
        { name: 'gateway' },
        `Object.values(this.connections).filter(c=>c.connected).map(a => ({
          id: a.cluster ? a.cluster.id : (a.interactions ? a.interactions.id : a.id),
          type: a.type
        }))`);

      res.status(200).json({ services: services[0] });
    } else {
      res.status(200).json({ services: [] });
    }
  }

};

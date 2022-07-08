const Base = require('../../../structures/RouteV2');

module.exports = class Status extends Base {

  // GET / (returns service statistics)
  async get (request, response) {
    if (request.app.locals.gw.connected) {
      const [shards, feeds, interactions, apis] = await Promise.all([
        request.app.locals.gw.action('stats', { name: 'shards' }),
        request.app.locals.gw.action('stats', { name: 'feeds' }),
        request.app.locals.gw.action('stats', { name: 'interactions' }),
        request.app.locals.gw.action('stats', { name: 'api' })
      ]);

      response.status(200).json({ shards: shards.flat().map(shard => ({
        uptime: shard.uptime,
        memory: shard.memory,
        id: shard.id,
        guilds: shard.guilds,
        shards: shard.shards.map(s => ({ id: s.shard, status: s.ok ? 'ready' : s.started ? 'resuming' : 'disconnected', guilds: s.num_guilds }))
      })), interactions, feeds, apis });
    } else {
      response.status(200).json({ shards: [], interactions: [], feeds: [], apis: [] });
    }
  }

};

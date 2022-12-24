const Base = require('../../../structures/RouteV2');

module.exports = class Status extends Base {

  // GET / (returns service statistics)
  async get (request, response) {
    if (request.app.locals.gw.connected) {
      let [shards, feeds, interactions, apis] = await Promise.all([
        request.app.locals.gw.action('stats', { name: 'shards' }),
        request.app.locals.gw.action('stats', { name: 'feeds' }),
        request.app.locals.gw.action('stats', { name: 'interactions' }),
        request.app.locals.gw.action('stats', { name: 'api' })
      ]);

      shards = shards.flat().map(shard => ({
        uptime: shard.uptime,
        memory: shard.memory,
        id: shard.id,
        guilds: shard.guilds,
        shards: shard.shards ? shard.shards.map(s => ({ id: s.shard, status: s.ok ? 'ready' : s.started ? 'resuming' : 'disconnected', guilds: s.num_guilds })) : []
      }));

      const serviceList = await request.app.locals.gw.action('serviceList', { name: 'gateway' });
      shards.push(...serviceList.filter(s => s.connected === false && s.type === 'shards').map(s => ({ id: s.id, status: 'disconnected' })));
      interactions.push(...serviceList.filter(s => s.connected === false && s.type === 'interactions').map(s => ({ id: s.id, status: 'disconnected' })));
      feeds.push(...serviceList.filter(s => s.connected === false && s.type === 'feeds').map(s => ({ id: s.id, status: 'disconnected' })));
      apis.push(...serviceList.filter(s => s.connected === false && s.type === 'api').map(s => ({ id: s.id, status: 'disconnected' })));

      response.status(200).json({
        shards,
        interactions,
        feeds,
        apis
      });
    } else {
      response.status(200).json({ shards: [], interactions: [], feeds: [], apis: [] });
    }
  }

};

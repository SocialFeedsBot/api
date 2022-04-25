const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const config = require('../../../../config.json');

module.exports = class Status extends Base {

  constructor() {
    super();

    this.register('get', '/', this.get.bind(this));
    this.register('get', '/messages', this.messages.bind(this));
    this.register('patch', '/messages', this.patchMessages.bind(this));
    this.register('get', '/services', this.services.bind(this));
  }

  /**
   * GET the status route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async get(req, res) {
    if (req.app.locals.gw.connected) {
      const shards = await req.app.locals.gw.action('stats', { name: 'shards' });
      const feeds = await req.app.locals.gw.action('stats', { name: 'feeds' });
      const interactions = await req.app.locals.gw.action('stats', { name: 'interactions' });
      const apis = await req.app.locals.gw.action('stats', { name: 'api' });
      res.status(200).json({ shards: shards.flat().map(shard => ({
        uptime: shard.uptime,
        memory: shard.memory,
        id: shard.id,
        guilds: shard.guilds,
        shards: shard.shards.map(s => ({ id: s.shard, status: s.ok ? 'ready' : s.started ? 'resuming' : 'disconnected', guilds: s.num_guilds }))
      })), interactions, feeds, apis });
    } else {
      res.status(200).json({ shards: [], interactions: [], feeds: [], apis: [] });
    }
  }

  /**
   * GET status messages.
   * @param {*} req {any}
   * @param {*} res {any}
   */
  async messages(req, res) {
    const msg = await req.app.locals.db.collection('statusMessages').findOne({ _id: 'status' });
    if (!msg) {
      res.status(200).json({ outage: false });
      return;
    }

    res.status(200).json({ head: msg.head, body: msg.body, status: msg.status });
  }

  /**
   * PATCH status messages.
   * @param {*} req {any}
   * @param {*} res {any}
   */
  async patchMessages(req, res) {
    let userID;
    let isBot;
    let auth;
    try {
      let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      userID = data.userID;
      isBot = !!data.bot;
      auth = true;
    } catch(e) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      auth = false;
      return;
    }

    if (!auth) {
      res.status(401).json({ success: false, error: 'Unauthorised' });
      return;
    }

    if (!config.admins.includes(userID) && !isBot) {
      res.status(401).json({ success: false, error: 'You are not an admin' });
      return;
    }

    await req.app.locals.db.collection('statusMessages').updateOne({ _id: 'status' }, { $set: {
      head: req.body.head,
      body: req.body.body,
      status: req.body.status
    } }, { upsert: true });

    res.status(200).json({ success: true });
  }

  /**
   * GET the service list route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async services(req, res) {
    if (req.app.locals.gw.connected) {
      const services = await req.app.locals.gw.action('serviceList', { name: 'gateway' });
      res.status(200).json({ services });
    } else {
      res.status(200).json({ services: [] });
    }
  }

};

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
      const clusters = await req.app.locals.gw.action('stats', { name: 'cluster' });
      const feeds = await req.app.locals.gw.action('stats', { name: 'feeds' });
      const interactions = await req.app.locals.gw.action('stats', { name: 'interactions' });
      const api = await req.app.locals.gw.action('stats', { name: 'api' });
      res.status(200).json({ clusters: clusters.flat(), interactions, feeds: feeds[0], api: api[0] });
    } else {
      res.status(200).json({ clusters: [], feeds: { uptime: 0 }, api: { uptime: 0 } });
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
      console.log(services);
      res.status(200).json({ services });
    } else {
      res.status(200).json({ services: [] });
    }
  }

};

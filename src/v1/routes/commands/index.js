/* Commands Route */
const Base = require('../../../structures/Route');
const config = require('../../../../config');
const jwt = require('jsonwebtoken');

module.exports = class Users extends Base {

  constructor() {
    super();

    this.register('get', '/', this.get.bind(this));
    this.register('get', '/disabled', this.getDisabled.bind(this), this.auth.bind(this));
    this.register('post', '/toggle', this.toggle.bind(this), this.auth.bind(this));
  }

  /**
   * GET the bot commands.
   * @param req {any} Request
   * @param res {any} Response
   */
  async get(req, res) {
    if (req.app.locals.gw.connected) {
      const [commands] = await req.app.locals.gw.action('getCommands', { name: 'interactions' });
      res.status(200).json(commands || []);
    } else {
      res.status(200).json([]);
    }
  }

  /**
   * Get a list of disabled commands.
   * @param {*} req 
   * @param {*} res 
   */
  async getDisabled(req, res) {
    if (!req.authInfo || (!req.authInfo.isBot && !req.authInfo.admin)) {
      res.status(403);
      return;
    }

    let keys = await req.app.locals.redis.keys('commands:*:disabled');
    let cmds = await Promise.all([...keys.map(async key => ({ name: key.replace('commands:', '').replace(':disabled', ''), reason: await req.app.locals.redis.get(key) }))])
    cmds = cmds.filter(cmd => cmd.reason !== 'no');

    res.status(200).json(cmds);
  }

  async toggle(req, res) {
    if (!req.authInfo || (!req.authInfo.isBot && !req.authInfo.admin)) {
      res.status(403);
      return;
    }

    const command = req.body.name;
    const toggle = req.body.disabled === true ? req.body.reason : 'no';

    await req.app.locals.redis.set(`commands:${command}:disabled`, toggle);
    res.status(200).json({ success: true });
  }

  auth(req, res, next) {
    let userID;
    let isBot;
    let auth;
    let token;
    try {
      let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      userID = data.userID;
      isBot = !!data.bot;
      token = data.access_token;
      auth = true;
    } catch(e) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      auth = false;
    }

    if (!auth) {
      res.status(401).json({ success: false, error: 'Unauthorised' });
      return;
    }
    req.authInfo = { admin: isBot || config.admins.includes(userID), isBot, userID, accessToken: token };
    next();
  }

   /**
   * Middleware to verify the person sending the request is authorised to do so.
   * @param req {any} Request
   * @param res {any} Response
   * @param next {any} Next
   */
  auth(req, res, next) {
    let userID;
    let isBot;
    let auth;
    let token;
    try {
       let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
       userID = data.userID;
       isBot = !!data.bot;
       token = data.access_token;
       auth = true;
     } catch(e) {
       res.status(401).json({ success: false, error: 'Not authenticated' });
        auth = false;
      }
  
      if (!auth) {
        res.status(401).json({ success: false, error: 'Unauthorised' });
        return;
      }
      req.authInfo = { admin: isBot || config.admins.includes(userID), isBot, userID, accessToken: token };
      next();
    }

};

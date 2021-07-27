/* Commands Route */
const Base = require('../../../structures/Route');

module.exports = class Users extends Base {

  constructor() {
    super();

    this.register('get', '/', this.get.bind(this));
    this.register('toggle', '/toggle', this.toggle.bind(this));
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

  async toggle(req, res) {
    if (!req.authInfo || (!req.authInfo.isBot && !req.authInfo.admin)) {
      res.status(403);
      return;
    }

    const command = req.query.command;
    const toggle = req.query.toggle;

    await req.app.locals.redis.set(`commands:${command}:disabled`, toggle === 'disable');
    res.status(200);
  }

};

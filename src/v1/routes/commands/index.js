/* Commands Route */
const Base = require('../../../structures/Route');

module.exports = class Users extends Base {

  constructor() {
    super();

    this.register('get', '/', this.get.bind(this));
  }

  /**
   * GET the bot commands.
   * @param req {any} Request
   * @param res {any} Response
   */
  async get(req, res) {
    if (req.app.locals.gw.connected) {
      const [commands] = await req.app.locals.gw.action('getCommands', { name: 'cluster' });
      res.status(200).json(commands || []);
    } else {
      res.status(200).json([]);
    }
  }

};

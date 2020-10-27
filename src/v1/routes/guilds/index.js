/* Guilds Route */
const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../../../config.json');

module.exports = class Guilds extends Base {

  constructor() {
    super();

    this.register('get', '/@me', this.getMe.bind(this));
    this.register('get', '/:id', this.getID.bind(this));
    this.register('get', '/:id/channels', this.getGuildChannels.bind(this));
  }

  /**
   * GET the current users guilds.
   * @param req {any} Request
   * @param res {any} Response
   */
  async getMe(req, res) {
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
      if (err) {
        res.status(500).json({ error: err.stack || err.message });
        return;
      }

      if (req.app.locals.storedUsers.get(data.userID)) {
        res.status(200).json(req.app.locals.storedUsers.get(data.userID));
      } else {
        const { body: guilds } = await superagent.get('https://discord.com/api/v7/users/@me/guilds')
          .set('Authorization', `Bearer ${data.access_token}`);

        let shared = await this.refreshUser(req.app, data.userID, guilds);
        res.status(200).json(guilds.filter(g => shared.includes(g.id)));
      }
    });
  }

  /**
   * GET a guild by its ID.
   * @param req {any} Request
   * @param res {any} Response
   * @returns {Promise<void>}
   */
  async getID(req, res) {
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
      if (err) {
        res.status(500).json({ error: err.stack || err.message });
        return;
      }

      let guild = await this.findGuild(req.app, data, req.params.id);
      if (guild.code) {
        res.status(guild.code).json(Object.assign(guild, { code: undefined }));
        return;
      }

      if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.status(200).json(guild);
    });
  }

  /**
   * GET a guilds channels by its ID.
   * @param req {any} Request
   * @param res {any} Response
   * @returns {Promise<void>}
   */
  async getGuildChannels(req, res) {
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
      if (err) {
        res.status(500).json({ error: err.stack || err.message });
        return;
      }

      let guild;
      if (req.app.locals.storedUsers.get(data.userID)) {
        guild = req.app.locals.storedUsers.get(data.userID).filter(g => g.id === req.params.id)[0];
      } else {
        const { body: guilds } = await superagent.get('https://discord.com/api/v7/users/@me/guilds')
          .set('Authorization', `Bearer ${data.access_token}`);

        let shared = await this.refreshUser(req.app, data.userID, guilds);
        guild = guilds.filter(g => shared.indexOf(g.id) !== -1).filter(g => g.id === req.params.id)[0];
      }

      if (!guild) {
        res.status(404).json({ error: 'Unknown guild' });
        return;
      }

      const channels = (await req.app.locals.gw.request({ t: 'cluster', id: 'all' }, `this.guilds.get('${req.params.id}') ? this.guilds.get('${req.params.id}').channels.toJSON() : null`)).filter(c => c)[0];
      res.status(200).json(channels);
    });
  }

  /**
   * Refresh the current users guilds.
   * @param app {any} App
   * @param userID {string} User ID
   * @param guilds {array} Array of guilds
   */
  async refreshUser(app, userID, guilds) {
    let shared = await app.locals.gw.requestSharedGuilds(guilds.map(g => g.id));
    shared = shared.result.flat();

    app.locals.storedUsers.set(userID, guilds.filter(g => shared.includes(g.id)));
    setTimeout(() => app.locals.storedUsers.delete(userID), 120 * 1000);

    return shared;
  }

  /**
   * Finds a guild that the bot shares with a user.
   * @param app {any} App
   * @param data {any} Stored user info
   * @param id {string} ID of the guild
   */
  async findGuild(app, data, id) {
    let guild;
    if (app.locals.storedUsers.get(data.userID)) {
      guild = app.locals.storedUsers.get(data.userID).filter(g => g.id === id)[0];
    } else {
      const { body: guilds } = await superagent.get('https://discord.com/api/v7/users/@me/guilds')
        .set('Authorization', `Bearer ${data.access_token}`);

      let shared = await this.refreshUser(app, data.userID, guilds);
      guild = guilds.filter(g => shared.includes(g.id)).filter(g => g.id === id)[0];
    }

    if (!guild) {
      return { code: 404, error: 'Unknown guild' };
    }

    return guild;
  }

};


// Constants
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../../config');

module.exports = class AuthMiddleware {

  // Main authorisation function, determines various info to pass
  static auth (req, res, next) {
    let authInfo = { userID: '', isBot: false, isAuthorised: false, acessToken: '' };

    // Try and authorise
    try {
      const data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      authInfo = { userID: data.useriD, isBot: !!data.bot, accessToken: data.access_token, isAuthorised: true };
    } catch(e) {
      res.status(401).json({ success: false, error: 'Not logged in' });
      authInfo.isAuthorised = false;
      return;
    }

    // Add admin field
    req.authInfo = Object.assign(authInfo, {
      admin: authInfo.isBot || config.admins.includes(authInfo.userID)
    });

    next();
  }

  // Check if someone has the correct permissions to manage a server
  static checkPermissions (_, res, guild) {
    // There is no guild?
    if (!guild) {
      res.status(404).json({ error: 'Server is unknown' });
      return false;
    }

    // Check permissions
    if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
      res.status(401).json({ error: 'You are not logged in' });
      return false;
    }

    return true;
  }

  // Get acccess token from code
  static async getAccessToken (code) {
    let body;
    try {
      body = (await superagent.post('https://discord.com/api/oauth2/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Authorization', `Basic ${Buffer.from(`${config.clientID}:${config.clientSecret}`).toString('base64')}`)
        .send({
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${config.url}/callback`,
          scope: 'identify guilds'
        })).body;

      return body;
    } catch (e) {
      return null;
    }
  }

  static async refreshAccessToken (refresh) {
    const { body: refreshToken } = await superagent.post('https://discord.com/api/v8/oauth2/token')
      .set('Authorization', `Basic ${Buffer.from(`${config.clientID}:${config.clientSecret}`).toString('base64')}`)
      .send({ grant_type: 'refresh_token', refresh_token: refresh });

    return refreshToken;
  }

  // Get a new user token
  static async refreshUser (app, id, token) {
    const guilds = await app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${token}`);
    await app.locals.redis.set(`users:${id}`, JSON.stringify({ userID: id, guilds }), 'EX', 60 * 5);
    return guilds;
  }

  static async findUser (app, id) {
    let userData = await app.locals.redis.get(`users:${id}`);
    if (!userData) {
      return null;
    } else {
      return JSON.parse(userData);
    }
  }

  static async findGuild (app, data, id) {
    let guild;
    let userData = await app.locals.redis.get(`users:${data.userID}`);
    if (!userData) {
      const guilds = await app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${data.accessToken}`);
      let shared = await AuthMiddleware.refreshUser(app, data.userID, data.accessToken);
      guild = guilds.filter(g => shared.includes(g.id)).filter(g => g.id === id)[0];
    } else {
      userData = JSON.parse(userData);
      guild = userData.guilds.filter(g => g.id === id)[0];
    }

    if (!guild) {
      return { code: 404, error: 'Unknown guild' };
    }

    return guild;
  }

};

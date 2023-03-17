// Constants
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../../config');

module.exports = class AuthMiddleware {

  // Main authorisation function, determines various info to pass
  static async auth (req, res, next) {
    let authInfo = { userID: '', isBot: false, isAuthorised: false, acessToken: '' };

    // Try and authorise
    try {
      const data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      let token;
      if (data.bot === true) {
        token = JSON.parse(await req.app.locals.redis.get(`api:tokens:${data.userID}`));
      }

      authInfo = { userID: data.userID, isBot: !!data.bot, accessToken: token?.access_token, isAuthorised: true };
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

  // Get user data and cache their data
  static async updateUser (app, userID) {
    // Refresh token if expired
    let token = JSON.parse(await app.locals.redis.get(`api:tokens:${userID}`));
    if (!token) {
      const refreshToken = await app.locals.redis.get(`api:refresh_tokens:${userID}`);
      if (!refreshToken) {
        return null;
      }
      token = (await superagent.post('https://discord.com/api/oauth2/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          client_id: config.clientID,
          client_secret: config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })).body;
      console.log('REFRESHED', token);
      await app.locals.redis.set(`api:refresh_tokens:${userID}`, token.refresh_token);
    }

    // Find cached user and return it
    const cachedUser = JSON.parse(await app.locals.redis.get(`api:users:${userID}`));
    console.log('CACHED USER');
    if (cachedUser) {
      return cachedUser;
    }

    // Get new user data
    const user = await app.locals.discordRest.api.users('@me').get(null, null, `Bearer ${token.access_token}`);
    console.log('GOT USER');
    const guilds = await app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${token.access_token}`);
    console.log('GOT GUILDS');

    // Cache user
    await app.locals.redis.set(`api:users:${user.id}`, JSON.stringify({ user, guilds }), 'EX', 60 * 5);

    // Sign new JWT secret
    try {
      jwt.sign({ userID: user.id }, config.jwtSecret, { expiresIn: token.expires_in }, null);
      return { user, guilds };
    } catch (e) {
      return { user, guilds };
    }
  }

  // Decode a JWT token
  static decodeJWT (code) {
    try {
      return jwt.verify(code, config.jwtSecret, null);
    } catch (e) {
      return null;
    }
  }

  static async findGuild (app, data, id) {
    let guild;
    let userData = await app.locals.redis.get(`api:users:${data.userID}`);
    if (!userData) {
      let { guilds } = await AuthMiddleware.updateUser(app, data.userID);
      guild = guilds.filter(g => g.id === id)[0];
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

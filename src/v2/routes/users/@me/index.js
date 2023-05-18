// Constants
const Base = require('../../../../structures/RouteV2');
const config = require('../../../../../config');
const { updateUser, decodeJWT } = require('../../../middleware/auth');

module.exports = class Users extends Base {

  // Get the current user
  async get (req, res) {
    // Check for authorization header
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }

    // Verify token
    const data = decodeJWT(req.headers.authorization);
    if (!data) {
      res.status(401).json({ error: 'Not logged in or parsing error' });
      return;
    }

    // Get user info and determine if admin
    const user = await updateUser(req.app, data.userID);
    if (!user) {
      res.status(401).json({ success: false, error: 'Not logged in or token expired, login again' });
      return;
    }

    user.user.admin = config.admins.includes(user.id) || undefined;
    res.status(200).json(user.user);
  }

};

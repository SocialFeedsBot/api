const jwt = require('jsonwebtoken');
const config = require('../../config');

module.exports = (req, res) => {
  let userID;
  let isBot;
  try {
    let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
    userID = data.userID;
    isBot = !!data.bot;
    return { auth: true, userID, isBot };
  } catch(e) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return { auth: false };
  }
};

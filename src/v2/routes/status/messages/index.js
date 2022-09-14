const Base = require('../../../../structures/RouteV2');

module.exports = class Status extends Base {

  // GET /status/messages (returns status messages)
  async get (req, res) {
    const msg = await req.app.locals.db.collection('statusMessages').findOne({ _id: 'status' });
    if (!msg) {
      res.status(200).json({ status: 'ok' });
      return;
    }

    res.status(200).json({ head: msg.head, body: msg.body, status: msg.status });
  }

};

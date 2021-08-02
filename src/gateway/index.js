// Gateway client for services to connect with.
const EventEmitter = require('events');
const WebSocket = require('ws');
const OPCodes = require('./OPCodes.js');

class GatewayClient extends EventEmitter {

  /**
   * @constructor
   * @param use {boolean}
   * @param service {string}
   * @param address {string}
   * @param secret {string}
   * @param id {string|number}
   */
  constructor (use, service, address, secret, id) {
    super();

    this.use = use;
    this.service = service;
    this.address = address;
    this.secret = secret;
    this.attempts = 0;

    this.id = id;
    this.ready = false;

    this.connected = false;
  }

  /**
   * Connect to the gateway.
   */
  connect () {
    this.started = Date.now();
    if (!this.use) {
      this.id = 0;
      this.emit('ready', { id: this.id });
    } else {
      this.ws = new WebSocket(this.address);
      this.ws.on('open', this.onConnect.bind(this));
      this.ws.on('close', this.onDisconnect.bind(this));
      this.ws.on('error', this.onError.bind(this));
    }
  }

  /**
   * Called when the WebSocket encounters an error.
   * @param error {Error}
   */
  onError (error) {
    this.emit('error', error);
  }

  /**
   * Called when the WebSocket connected to the server.
   */
  onConnect () {
    this.attempts = 1;
    this.connected = true;
    this.emit('connect', Date.now() - this.started);
    this.ws.on('message', msg => {
      msg = JSON.parse(msg);
      this.onMessage(msg);
    });
  }

  /**
   * Called when the WebSocket disconnects from the server.
   * @param code {number}
   * @param message {string}
   */
  onDisconnect (code, message) {
    this.connected = false;
    this.attempts++;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    setTimeout(() => {
      this.emit('disconnect', { message, attempts: this.attempts });
      this.connect();
    }, 1500);
  }

  /**
   * Send a message to the server.
   * @param op {number}
   * @param data {object?}
   * @param extras {object?}
   */
  send (op, data = {}, extras = {}) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify(Object.assign(extras, { op, data })));
  }

  /**
   * Called when the server sends a message.
   * @param packet {object}
   */
  onMessage (packet) {
    this.emit('message', packet);
    switch (packet.op) {

      case OPCodes.HELLO: {
        this.heartbeat();
        if (this.ready) {
          this.resume();
        } else {
          this.identify();
        }
        this.heartbeatInterval = setInterval(this.heartbeat.bind(this), packet.data.heartbeat_interval);
        return;
      }

      case OPCodes.READY: {
        this.emit('ready', packet.data);
        this.id = packet.data.id;
        return;
      }

      case OPCodes.ACTION: {
        if (packet.type === 'resolveAction') {
          this.emit(`resolve_${packet.id}`, packet.data.results);
        } else {
          switch (packet.type) {
            case 'stats': {
              let stats = {
                uptime: process.uptime() * 1000,
                memory: process.memoryUsage().heapUsed,
                id: this.id
              };

              if (this.getExtraStats) {
                let extra = this.getExtraStats();
                stats = { ...stats, ...extra };
              }

              this.resolve(packet.id, stats);
              break;
            }

            case 'restart': {
              process.exit(1);
              break;
            }

            case 'requestSharedGuilds': {
              this.emit('requestSharedGuilds', packet);
              break;
            }

            default:
              this.emit(packet.type, packet.data, (result) => {
                this.resolve(packet.id, result);
              });
              break;
          }
        }
        break;
      }

      case OPCodes.HEARTBEAT_ACK: {
        this.latency = Date.now() - this.lastSentHeartbeat;
        this.emit('latency', this.latency);
        break;
      }

    }
  }

  /**
   * Send an action.
   * @param target {{name: string, id: object?}} Target data
   * @param data {string} Data
   */
  async action (type, target, data) {
    if (!this.connected) return [];
    const id = (process.hrtime().reduce((a, b) => a + b) + Date.now()).toString(36);

    return new Promise((resolve) => {
      this.send(OPCodes.ACTION, data, { destination: target, id, type });
      this.once(`resolve_${id}`, resolve);
    });
  }

  /**
   * Send a list of shared guilds.
   * @param packet
   * @param result
   */
  sendSharedGuilds (packet, result) {
    if (!this.connected) return;
    this.send(OPCodes.ACTION, result, { id: packet.id, type: 'resolveAction' });
  }

  /**
   * Request shared guilds (API ONLY)
   * @param guilds
   * @returns {Promise<any>>}
   */
  requestSharedGuilds (guilds) {
    if (this.service !== 'api') return [];
    const id = (process.hrtime().reduce((a, b) => a + b) + Date.now()).toString(36);
    return new Promise((resolve) => {
      this.send(OPCodes.ACTION, guilds, { id, type: 'requestSharedGuilds', destination: { name: 'shards' } });
      this.once(`resolve_${id}`, resolve);
    });
  }

  /**
   * Resolve a request sent.
   * @param id {string} Request id
   * @param data {any} Data to send
   */
  resolve (id, data) {
    if (!this.connected) return;
    this.send(OPCodes.ACTION, data, { id, type: 'resolveAction' });
  }

  /**
   * Restart selected services.
   * @param ids
   */
  restart ({ name, id, restarter, panel }) {
    if (!this.connected) return;
    this.send(OPCodes.ACTION, { restarter, panel: panel || false }, { destination: { name, id }, type: 'restart' });
  }

  /**
   * Send a heartbeat.
   */
  heartbeat () {
    this.lastSentHeartbeat = Date.now();
    this.send(OPCodes.HEARTBEAT);
  }

  /**
   * Identify this service.
   */
  identify () {
    const payload = {
      service: this.service,
      id: this.id,
      secret: this.secret
    };
    this.send(OPCodes.IDENTIFY, payload);
  }

  /**
   * RESUME this service.
   */
  resume () {
    this.send(OPCodes.RESUME, {
      service: this.service,
      id: this.id,
      secret: this.secret
    });
  }

  /**
   * Class this service as ready.
   */
  sendReady () {
    if (this.ready) return;
    this.ready = true;
    this.send(OPCodes.READY);
  }

}

module.exports = GatewayClient;

const { API_URL, API_VERSION } = require('./Constants');
const axios = require('axios');
const HTTPError = require('./HTTPError');
const DiscordAPIError = require('./DiscordAPIError');
const Bucket = require('./Bucket');
const routeBuilder = require('./routeBuilder');

module.exports = class RESTHandler {

  /**
   * @param {object} [options]
   * @param {string} [options.apiURL]
   * @param {number} [options.apiVersion]
   * @param {string} [options.token]
   */
  constructor (options = {}) {
    const baseURL = options.apiURL || API_URL;
    const version = options.apiVersion || API_VERSION;

    this.baseURL = `${baseURL}/v${version}`;
    this.ratelimits = {};

    Object.defineProperty(this, 'token', { value: options.token });
  }

  /**
   * @returns {api}
   */
  get api () {
    return routeBuilder(this);
  }

  /**
   * Makes a request.
   * @param method {'get' | 'post' | 'patch' | 'delete' | 'put' }
   * @param endpoint {string}
   * @param data {object?}
   * @param query {object?}
   * @param _attempts {number?}
   * @param immediate {boolean?}
   */
  request (method, endpoint, data = {}, query = {}, authToken = null, _attempts = 0, immediate = false) {
    const route = this.getRoute(method, endpoint);
    if (!this.ratelimits[route]) {
      this.ratelimits[route] = new Bucket();
    }

    return new Promise((resolve, reject) => {
      const fn = (callback) => {
        const options = {
          validateStatus: null,
          headers: {
            Authorization: authToken ? authToken : `Bot ${this.token}`,
            'Content-Type': 'application/json'
          },
          baseURL: this.baseURL,
          url: endpoint,
          method: method,
          data: ['put', 'patch', 'post'].includes(method) ? data : undefined,
          params: query
        };

        axios.request(options)
          .then(res => {
            //  Increase the number of attempts
            ++_attempts;

            //  Add the rate limit header data to the bucket
            this.parseRateLimitHeaders(route, res.headers);

            //  Reject with an APIError or HTTPError
            const rejectWithError = () => {
              if (res.data && res.data.errors) {
                reject(new DiscordAPIError(res));
              } else {
                reject(new HTTPError(res));
              }
            };

            const retryRequest = () => {
              //  Use the retry-after header to schedule the request to retry
              if (res.headers['retry-after']) {
                setTimeout(() => {
                  this.request(method, endpoint, data, query, authToken, _attempts, true)
                    .then(resolve)
                    .catch(reject);
                }, +res.headers['retry-after'] * 1000);
              } else {
                //  Retry immediately if no retry-after header
                this.request(method, endpoint, data, query, authToken, _attempts, true)
                  .then(resolve)
                  .catch(reject);
              }
            };

            if (res.status >= 200 && res.status < 300) {
              resolve(res.data);
            } else if (res.status === 429) {
              //  Check if too many retry attempts
              if (_attempts >= 5) {
                rejectWithError();
              } else {
                retryRequest();
              }
            } else {
              rejectWithError();
            }

            callback();
          });
      };

      if (immediate) {
        this.ratelimits[route].unshift(fn);
      } else {
        this.ratelimits[route].queue(fn);
      }
    });

  }

  /**
   * Make a route to put in the endpoints object.
   * @param method {'get' | 'post' | 'patch' | 'delete' | 'put' }
   * @param endpoint {string}
   * @returns {string}
   */
  getRoute (method, endpoint) {
    let route = endpoint.replace(/\/([a-z-]+)\/(?:(\d+))/g,
      (match, p) => ['guilds', 'channels', 'webhooks'].includes(p) ? match : `/${p}/:id`);

    route = route
      .replace(/\/reactions\/[^/]+/g, '/reactions/:id')
      .replace(/^\/webhooks\/(\d+)\/[A-Za-z0-9-_]{64,}/, '/webhooks/$1/:token')
      .replace(/\/invites\/[^/]+/g, '/invites/:id');

    if (method === 'delete' && route.endsWith('/messages/:id')) {
      route = `${method}/${route}`;
    }

    return route;
  }

  /**
   * Send headers to bucket.
   * @param route {string}
   * @param headers {object}
   */
  parseRateLimitHeaders (route, headers) {
    const now = Date.now();

    if (headers['x-ratelimit-limit']) {
      this.ratelimits[route].limit = +headers['x-ratelimit-limit'];
    }

    if (headers['x-ratelimit-remaining'] === undefined) {
      this.ratelimits[route].remaining = 1;
    } else {
      this.ratelimits[route].remaining = +headers['x-ratelimit-remaining'] || 0;
    }

    if (headers['retry-after']) {
      this.ratelimits[route].reset = (+headers['retry-after'] * 1000 || 1000) + now;
    } else if (headers['x-ratelimit-reset']) {
      this.ratelimits[route].reset = Math.max(+headers['x-ratelimit-reset'], now);
    } else {
      this.ratelimits[route].reset = now;
    }
  }

};

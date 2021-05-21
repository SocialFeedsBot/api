/**
 * Represents a HTTP error from a request.
 * @extends Error
 */
module.exports = class HTTPError extends Error {

  constructor (res) {
    super();

    /**
     * The name of the error
     * @type {string}
     */
    this.name = this.constructor.name;

    /**
     * HTTP error code returned from the request
     * @type {number}
     */
    this.code = res.code || 500;

    /**
     * The HTTP method used for the request
     * @type {string}
     */
    this.method = res.method;

    /**
     * The error message.
     * @type {string}
     */
    this.message = res.statusText || 'Unknown error';
  }

};

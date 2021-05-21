/**
 * Represents an error from the Discord API.
 * @extends Error
 */
module.exports = class DiscordAPIError extends Error {

  constructor (res) {
    super();
    const flattened = this.constructor.flattenErrors(res.data.errors || res.data.message).join('\n');
    this.name = 'DiscordAPIError';
    this.message = res.data.message && flattened ? `${res.data.message}\n${flattened}` : res.data.message || flattened;

    /**
     * The HTTP method used for the request
     * @type {string}
     */
    this.method = res.method;

    /**
     * HTTP error code returned by Discord
     * @type {number}
     */
    this.code = res.code || -1;
  }

  /**
   * Flattens an errors object returned from the API into an array.
   * @param {Object} obj Discord errors object
   * @param {string} [key] Used internally to determine key names of nested fields
   * @returns {string[]}
   * @private
   */
  static flattenErrors (obj, key = '') {
    let messages = [];

    for (const [k, v] of Object.entries(obj)) {
      if (k === 'message') continue;
      const newKey = key ? (isNaN(k) ? `${key}.${k}` : `${key}[${k}]`) : k;

      if (v._errors) {
        messages.push(`${newKey}: ${v._errors.map(e => e.message).join(' ')}`);
      } else if (v.code || v.message) {
        messages.push(`${v.code ? `${v.code}: ` : ''}${v.message}`.trim());
      } else if (typeof v === 'string') {
        messages.push(v);
      } else {
        messages = messages.concat(this.flattenErrors(v, newKey));
      }
    }

    return messages;
  }

};

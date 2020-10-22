module.exports = class Extension {

  constructor(baseLogger, name) {
    this.baseLogger = baseLogger;
    this.name = name;
  }

  info(...text) {
    return this.baseLogger.log(this.name, 'info', ...text);
  }

  warn(...text) {
    return this.baseLogger.log(this.name, 'warn', ...text);
  }

  debug(...text) {
    return this.baseLogger.log(this.name, 'debug', ...text);
  }

  error(...text) {
    return this.baseLogger.log(this.name, 'error', ...text);
  }

  extension(name) {
    return this.baseLogger.extension(name);
  }
};

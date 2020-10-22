const Extension = require('./Extension');

function getDateString() {
  const d = new Date();

  const hours = `0${d.getHours()}`.slice(-2);
  const minutes = `0${d.getMinutes()}`.slice(-2);
  const seconds = `0${d.getSeconds()}`.slice(-2);

  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${hours}:${minutes}:${seconds}`;
}

module.exports = class Logger {

  constructor(name, sensitive = []) {
    this.name = name;
    this.sensitive = sensitive;

    this.extensions = {};
    this.history = [];
  }

  add(text) {
    this.history.push(text);
    while (this.history.join('\n').length > 2000) {
      this.history = this.history.splice(1);
    }
  }

  getHistory() {
    return this.history.join('\n');
  }

  replaceSensitive(string) {
    for (const sensitive of this.sensitive) {
      string = string.replace(new RegExp(sensitive, 'gi'), '[SENSITIVE]');
    }

    return string;
  }

  log(name, type, ...text) {
    text = this.replaceSensitive(text.join(' '));
    const dateString = getDateString();
    const string = `${dateString} [${name}:${type.toUpperCase()}] ${text}`;

    this.add(string);
    console.log(string);

    return string;
  }

  info(...text) {
    return this.log(this.name, 'info', ...text);
  }

  warn(...text) {
    return this.log(this.name, 'warn', ...text);
  }

  debug(...text) {
    return this.log(this.name, 'debug', ...text);
  }

  error(...text) {
    return this.log(this.name, 'error', ...text);
  }

  extension(name) {
    if (!this.extensions[name]) {
      this.extensions[name] = new Extension(this, name);
    }

    return this.extensions[name];
  }

};

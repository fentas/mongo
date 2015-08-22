// https://raw.githubusercontent.com/extrabacon/python-shell/master/index.js
//
var EventEmitter = require('events').EventEmitter;
var path = require('path');
var util = require('util');
var spawn = require('child_process').spawn;

function toArray(source) {
    if (typeof source === 'undefined' || source === null) {
        return [];
    } else if (!Array.isArray(source)) {
        return [source];
    }
    return source;
}

function extend(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (source) {
        if (source) {
            for (var key in source) {
                obj[key] = source[key];
            }
        }
    });
    return obj;
}

/**
 * An interactive Bash shell exchanging data through stdio
 * @param {string} script    The bash script to execute
 * @param {object} [options] The launch options (also passed to child_process.spawn)
 * @constructor
 */
var BashShell = function (script, options) {

    function resolve(type, val) {
        if (typeof val === 'string') {
            // use a built-in function using its name
            return BashShell[type][val];
        } else if (typeof val === 'function') {
            // use a custom function
            return val;
        }
    }

    var self = this;
    var errorData = '';
    EventEmitter.call(this);

    options = extend({}, BashShell.defaultOptions, options);
    var bashPath = options.bashPath || 'bash';
    var bashOptions = toArray(options.bashOptions);
    var scriptArgs = toArray(options.args);

    this.script = path.join(options.scriptPath || './bash', script);
    this.command = bashOptions.concat(this.script, scriptArgs);
    this.mode = options.mode || 'text';
    this.formatter = resolve('format', options.formatter || this.mode);
    this.parser = resolve('parse', options.parser || this.mode);
    this.terminated = false;
    this.childProcess = spawn(bashPath, this.command, options);

    ['stdout', 'stdin', 'stderr'].forEach(function (name) {
        self[name] = self.childProcess[name];
        self.parser && self[name].setEncoding(options.encoding || 'utf8');
    });

    // parse incoming data on stdout
    if (this.parser) {
        this.stdout.on('data', BashShell.prototype.receive.bind(this));
    }

    // listen to stderr and emit errors for incoming data
    this.stderr.on('data', function (data) {
        errorData += ''+data;
    });

    this.childProcess.on('exit', function (code) {
        var err;
        if (errorData || code !== 0) {
            if (errorData) {
                err = self.parseError(errorData);
            } else {
                err = new Error('process exited with code ' + code);
            }
            err = extend(err, {
                executable: bashPath,
                options: bashOptions.length ? bashOptions : null,
                script: self.script,
                args: scriptArgs.length ? scriptArgs : null,
                exitCode: code
            });
            // do not emit error if only a callback is used
            if (self.listeners('error').length || !self._endCallback) {
                self.emit('error', err);
            }
        }
        self.exitCode = code;
        self.terminated = true;
        self.emit('close');
        self._endCallback && self._endCallback(err);
    });
};
util.inherits(BashShell, EventEmitter);

// allow global overrides for options
BashShell.defaultOptions = {};

// built-in formatters
BashShell.format = {
    text: function toText(data) {
        if (!data) return '';
        else if (typeof data !== 'string') return data.toString();
        return data;
    },
    json: function toJson(data) {
        return JSON.stringify(data);
    }
};

// built-in parsers
BashShell.parse = {
    text: function asText(data) {
        return data;
    },
    json: function asJson(data) {
        return JSON.parse(data);
    }
};

/**
 * Runs a Bash script and returns collected messages
 * @param  {string}   script   The script to execute
 * @param  {Object}   options  The execution options
 * @param  {Function} callback The callback function to invoke with the script results
 * @return {BashShell}       The BashShell instance
 */
BashShell.run = function (script, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = null;
    }

    var pyshell = new BashShell(script, options);
    var output = [];

    return pyshell.on('message', function (message) {
        output.push(message);
    }).end(function (err) {
        if (err) return callback(err);
        return callback(null, output.length ? output : null);
    });
};

/**
 * Parses an error thrown from the Bash process through stderr
 * @param  {string|Buffer} data The stderr contents to parse
 * @return {Error} The parsed error with extended stack trace when traceback is available
 */
BashShell.prototype.parseError = function (data) {
    var text = ''+data;
    var error;

    if (/^Traceback/.test(text)) {
        // traceback data is available
        var lines = (''+data).trim().split(/\n/g);
        var exception = lines.pop();
        error = new Error(exception);
        error.traceback = data;
        // extend stack trace
        error.stack += '\n    ----- Bash Traceback -----\n  ';
        error.stack += lines.slice(1).join('\n  ');
    } else {
        // otherwise, create a simpler error with stderr contents
        error = new Error(text);
    }

    return error;
};

/**
 * Sends a message to the Bash shell through stdin
 * Override this method to format data to be sent to the Bash process
 * @param {string|Object} data The message to send
 * @returns {BashShell} The same instance for chaining calls
 */
BashShell.prototype.send = function (message) {
    var data = this.formatter ? this.formatter(message) : message;
    if (this.mode !== 'binary') data += '\n';
    this.stdin.write(data);
    return this;
};

/**
 * Parses data received from the Bash shell stdout stream and emits "message" events
 * This method is not used in binary mode
 * Override this method to parse incoming data from the Bash process into messages
 * @param {string|Buffer} data The data to parse into messages
 */
BashShell.prototype.receive = function (data) {
    var self = this;
    var parts = (''+data).split(/\n/g);

    if (parts.length === 1) {
        // an incomplete record, keep buffering
        this._remaining = (this._remaining || '') + parts[0];
        return this;
    }

    var lastLine = parts.pop();
    // fix the first line with the remaining from the previous iteration of 'receive'
    parts[0] = (this._remaining || '') + parts[0];
    // keep the remaining for the next iteration of 'receive'
    this._remaining = lastLine;

    parts.forEach(function (part) {
        try {
            self.emit('message', self.parser(part));
        } catch(err) {
            self.emit('error', extend(
                new Error('invalid message: ' + data + ' >> ' + err),
                { inner: err, data: part}
            ));
        }
    });

    return this;
};

/**
 * Closes the stdin stream, which should cause the process to finish its work and close
 * @returns {BashShell} The same instance for chaining calls
 */
BashShell.prototype.end = function (callback) {
    this.childProcess.stdin.end();
    this._endCallback = callback;
    return this;
};

module.exports = BashShell;

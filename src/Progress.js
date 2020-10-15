exports = module.exports = ProgressBar;

/**
 * Initialize a `ProgressBar` with the given `fmt` string and `options` or
 * `total`.
 *
 * Options:
 *
 *   - `curr` current completed index
 *   - `total` total number of ticks to complete
 *   - `width` the displayed width of the progress bar defaulting to total
 *   - `stream` the output stream defaulting to stderr
 *   - `head` head character defaulting to complete character
 *   - `complete` completion character defaulting to "="
 *   - `incomplete` incomplete character defaulting to "-"
 *   - `renderThrottle` minimum time between updates in milliseconds defaulting to 16
 *   - `callback` optional function to call when the progress bar completes
 *   - `clear` will clear the progress bar upon termination
 *
 * Tokens:
 *
 *   - `:bar` the progress bar itself
 *   - `:current` current tick number
 *   - `:total` total ticks
 *   - `:elapsed` time elapsed in seconds
 *   - `:percent` completion percentage
 *   - `:eta` eta in seconds
 *   - `:rate` rate of ticks per second
 *
 * @param {string} fmt
 * @param {object|number} options or total
 * @api public
 */

function ProgressBar(fmt, options) {
    this.stream = options.stream || process.stderr;

    if (typeof options == "number") {
        var total = options;
        options = {};
        options.total = total;
    } else {
        options = options || {};
        if ("string" != typeof fmt) throw new Error("format required");
        if ("number" != typeof options.total) throw new Error("total required");
    }

    this.fmt = fmt;
    this.curr = options.curr || 0;
    this.total = options.total;
    this.width = options.width || this.total;
    this.clear = options.clear;
    this.chars = {
        complete: options.complete || "=",
        incomplete: options.incomplete || "-",
        head: options.head || options.complete || "="
    };
    this.renderThrottle = options.renderThrottle !== 0 ? options.renderThrottle || 16 : 0;
    this.lastRender = -Infinity;
    this.callback = options.callback || function () {};
    this.tokens = {};
    this.lastDraw = "";
}

/**
 * "tick" the progress bar with optional `len` and optional `tokens`.
 *
 * @param {number|object} len or tokens
 * @param {object} tokens
 * @api public
 */

ProgressBar.prototype.tick = function (len, tokens) {
    if (len !== 0) len = len || 1;

    // swap tokens
    if ("object" == typeof len) (tokens = len), (len = 1);
    if (tokens) this.tokens = tokens;

    // start time for eta
    if (0 == this.curr) this.start = new Date();

    this.curr += len;

    // try to render

    // progress complete
    if (this.curr >= this.total) {
        this.render(undefined, true);
        this.complete = true;
        this.callback(this);
        return;
    }

    return this.render();
};

/**
 * Method to render the progress bar with optional `tokens` to place in the
 * progress bar's `fmt` field.
 *
 * @param {object} tokens
 * @api public
 */

ProgressBar.prototype.render = function (tokens, force) {
    force = force !== undefined ? force : false;
    if (tokens) this.tokens = tokens;

    if (!this.stream.isTTY) return;

    var now = Date.now();
    var delta = now - this.lastRender;
    if (!force && delta < this.renderThrottle) {
        return;
    } else {
        this.lastRender = now;
    }

    var ratio = this.curr / this.total;
    ratio = Math.min(Math.max(ratio, 0), 1);

    var percent = Math.floor(ratio * 100);
    var incomplete, complete, completeLength;
    var elapsed = new Date() - this.start;
    var eta = percent == 100 ? 0 : elapsed * (this.total / this.curr - 1);
    var rate = this.curr / (elapsed / 1000);

    /* populate the bar template with percentages and timestamps */
    var str = this.fmt
        .replace(":current", this.curr)
        .replace(":total", this.total)
        .replace(":elapsed", isNaN(elapsed) ? "0.0" : (elapsed / 1000).toFixed(1))
        .replace(":eta", isNaN(eta) || !isFinite(eta) ? "0.0" : (eta / 1000).toFixed(1))
        .replace(":percent", percent.toFixed(0) + "%")
        .replace(":rate", Math.round(rate));

    /* compute the available space (non-zero) for the bar */
    var availableSpace = Math.max(0, this.stream.columns - str.replace(":bar", "").length);
    if (availableSpace && process.platform === "win32") {
        availableSpace = availableSpace - 1;
    }

    var width = Math.min(this.width, availableSpace);

    /* TODO: the following assumes the user has one ':bar' token */
    completeLength = Math.round(width * ratio);
    complete = Array(Math.max(0, completeLength + 1)).join(this.chars.complete);
    incomplete = Array(Math.max(0, width - completeLength + 1)).join(this.chars.incomplete);

    /* add head to the complete string */
    if (completeLength > 0) complete = complete.slice(0, -1) + this.chars.head;

    /* fill in the actual progress bar */
    str = str.replace(":bar", complete + incomplete);

    /* replace the extra tokens */
    if (this.tokens) for (var key in this.tokens) str = str.replace(":" + key, this.tokens[key]);

    return str;
};

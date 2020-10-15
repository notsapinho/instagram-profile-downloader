const ow = require("ow");
const puppeteer = require("puppeteer-extra");

const signin = require("./lib/signin");
const signout = require("./lib/signout");

puppeteer.use(require("puppeteer-extra-plugin-stealth")());

/**
 * [Instagram](https://instagram.com) automation driven by headless chrome.
 *
 * @param {Object} [opts={ }] - Options
 * @param {Object} [opts.browser] - Puppeteer browser instance to use
 * @param {Object} [opts.puppeteer] - Puppeteer [launch options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions)
 */
class PuppeteerInstagram {
    constructor(opts = {}) {
        this._opts = opts;
        this._user = null;
    }

    /**
     * Whether or not this instance is authenticated with Instagram.
     *
     * @member {boolean}
     */
    get isAuthenticated() {
        return !!this._user;
    }

    /**
     * Authenticated user if authenticated with Instagram.
     *
     * @member {Object}
     */
    get user() {
        return this._user;
    }

    /**
     * Puppeteer Browser instance to use.
     *
     * @return {Promise<Object>}
     */
    async browser() {
        if (!this._browser) {
            this._browser = this._opts.browser || (await puppeteer.launch(this._opts.puppeteer));
        }

        return this._browser;
    }

    /**
     * Signs into an existing Instagram account.
     *
     * Note: either username or email is required.
     *
     * @param {Object} user - User details for new account
     * @param {string} [user.username] - Username
     * @param {string} [user.email] - Email
     * @param {string} user.password - Password
     * @param {Object} [opts={ }] - Options
     * @return {Promise}
     */
    async signin(user, opts = {}) {
        if (this.isAuthenticated) throw new Error('"signin" requires no authentication');

        ow(user, ow.object.plain.nonEmpty.label("user"));
        ow(user.password, ow.string.nonEmpty.label("user.password"));

        if (user.email) {
            ow(user.email, ow.string.nonEmpty.label("user.email"));
        } else {
            ow(user.username, ow.string.nonEmpty.label("user.username"));
        }

        const browser = await this.browser();
        await signin(browser, user, opts);

        this._user = user;
    }

    /**
     * Signs out of the currently authenticated Instagram account.
     * @return {Promise}
     */
    async signout() {
        if (!this.isAuthenticated) throw new Error('"signout" requires authentication');
        const browser = await this.browser();

        await signout(browser, this._user);
        this._user = null;
    }

    /**
     * Closes the underlying browser instance, effectively ending this session.
     *
     * @return {Promise}
     */
    async close() {
        const browser = await this.browser();
        await browser.close();

        this._browser = null;
        this._user = null;
    }
}

module.exports = PuppeteerInstagram;

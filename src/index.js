const fetch = require("node-fetch");
const logger = require("ora");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const readline = require("readline");
const PuppeteerInstagram = require("./puppeteer-instagram");
const Scraper = require("./Scraper");
const ProgressBar = require("./Progress");
const Downloader = require("./Downloader");
require("dotenv/config");

const spinner = {
    interval: 60,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
};

class InstagramDownloader {
    constructor(username, dir) {
        this.download_path = dir || path.join("downloads/", username);
        this.highlight_path = dir || path.join("downloads/", username, "/stories");
        this.url = "https://www.instagram.com/" + username;

        this.downloader = new Downloader(this);
        this.scraper = new Scraper(this);
    }

    async init() {
        const res = await (await fetch(this.url + "?__a=1")).json();

        if ((Object.keys(res).length === 0 && res.constructor === Object) || !res) {
            console.log("[INVALID ACCOUNT]");
            process.exit();
        }

        const browser = await puppeteer.launch({
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            headless: true
        });

        const page = await browser.newPage();

        this.log = logger({
            spinner
        }).start("[LOGGING IN]");

        page.setDefaultNavigationTimeout(0);
        const instagram = new PuppeteerInstagram({ browser });

        await instagram.signin({ username: process.env.USER, password: process.env.PASSWORD });

        await page.goto(this.url);

        const cookies = (await page.cookies()).map((x) => `${x.name}=${x.value}`).join(";");

        this.log.succeed("[LOGGED IN]");

        this.id = res.logging_page_id.replace("profilePage_", "");
        this.browser = browser;
        this.instagram = instagram;
        this.page = page;
        this.cookies = cookies;
    }

    async download(srcs, type) {
        if (type === "posts") {
            this.bar = new ProgressBar("[POSTS] [:bar] :current/:total :etas", { width: 20, total: srcs.length });
            this.log.start(this.bar.render());
            if (!fs.existsSync(this.download_path)) fs.mkdirSync(this.download_path);
            this.downloader.downloadFiles(srcs.map((link, i) => ({ link, type, client: this, dir: this.download_path, i })));
            await this.downloader.q.drain();
        } else {
            const len = srcs.map((x) => x.srcs).flat().length;
            if(!len) return;
            this.bar = new ProgressBar("[HIGHLIGHTS] [:bar] :current/:total :etas", { width: 20, total: len });
            this.log.start(this.bar.render());
            if (!fs.existsSync(this.highlight_path)) fs.mkdirSync(this.highlight_path);
            this.downloader.downloadFiles(srcs.map((x) => x.srcs.map((link, i) => ({ link, type, title: x.title, client: this, dir: this.highlight_path, i })).flat()));
            await this.downloader.q.drain();
        }
    }
}

console.clear();

const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

input.question("[USERNAME]: ", async (username, hl = true, dir = null) => {
    const client = new InstagramDownloader(username, dir);

    await client.init();

    client.log.start("[COLLECTING POSTS]");
    const posts = await client.scraper.get_posts_from_instagram();
    client.log.succeed("[POSTS COLLECTED]");

    await client.download(posts, "posts");

    if (hl) {
        client.log.start("[COLLECTING HIGHLIGHTS]");
        const highlights = await client.scraper.get_highlights_from_instagram();
        client.log.succeed("[HIGHLIGHTS COLLECTED]");

        await client.download(highlights, "highlights");
    }

    client.log.succeed("[DOWNLOADED]");

    process.exit();
});

const downloader = require("./downloader");
const fetch = require("node-fetch");
const logger = require("ora");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const readline = require("readline");

const spinner = {
    interval: 60,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
};

async function download_posts_from_instagram(username, dir = null) {
    const download_path = dir || username;
    const url = path.join("https://www.instagram.com/", username);

    const browser = await puppeteer.launch({
        // For Linux or WSL

        //executablePath: "/usr/bin/chromium-browser",
        //args: ["--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox", "--no-first-run", "--no-sandbox", "--no-zygote", "--single-process"],

        // For Windows

        executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",

        headless: true // Open chrome or not(true means that is off), recommended to be false
    });

    const page = await browser.newPage();

    const dataLog = logger({
        text: "[GETTING DATA]",
        spinner
    }).start();

    page.setDefaultNavigationTimeout(0);
    await page.goto(url);

    dataLog.succeed("[DATA COLLECTED]");

    const postsLog = logger({
        text: "[DOWNLOADING POSTS]",
        spinner
    }).start();

    const posts = await downloader(page, 3000);

    postsLog.succeed("[POSTS DOWNLOADED]");

    if (!fs.existsSync(download_path)) fs.mkdirSync(download_path);

    const savingLog = logger({
        text: "[SAVING VIDEOS]",
        spinner
    }).start();

    for (let i = 0; i < posts.length; i++) {
        const filename = path.join(download_path, i + posts[i].extension);
        fs.writeFileSync(filename, Buffer.from(posts[i].data));
    }

    await browser.close();
    savingLog.succeed("[VIDEOS SAVED]");

    process.exit();
}

const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

input.question("[USERNAME]: ", download_posts_from_instagram);

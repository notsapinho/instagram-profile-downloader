const { get_posts_from_instagram, get_highlights, get_highlights_srcs, download } = require("./downloader");
const fetch = require("node-fetch");
const logger = require("ora");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const readline = require("readline");
const PuppeteerInstagram = require("./puppeteer-instagram");

const spinner = {
    interval: 60,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
};

async function download_posts_from_instagram(username, hl = true, dir = null) {
    if (!username) return process.exit();

    const download_path = dir || path.join("downloads/", username);
    const highlight_path = dir || path.join("downloads/", username, "/stories");
    const url = "https://www.instagram.com/" + username;

    const res = await (await fetch(url + "?__a=1")).json();

    if ((Object.keys(res).length === 0 && res.constructor === Object) || !res) {
        console.log("[INVALID ACCOUNT]");
        process.exit();
    }

    const browser = await puppeteer.launch({
        // For Windows

        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

        headless: false
    });

    const page = await browser.newPage();

    const dataLog = logger({
        text: "[GETTING DATA]",
        spinner
    }).start();

    page.setDefaultNavigationTimeout(0);
    const instagram = new PuppeteerInstagram({ browser });

    await instagram.signin({ username: process.env.USERNAME, password: process.env.PASSWORD });

    await page.goto(url);

    const cookies = (await page.cookies()).map((x) => `${x.name}=${x.value}`).join(";");

    dataLog.succeed("[DATA COLLECTED]");

    const postsLog = logger({
        text: "[DOWNLOADING POSTS]",
        spinner
    }).start();

    const posts = await get_posts_from_instagram(page, cookies, 3000);

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

    savingLog.succeed("[VIDEOS SAVED]");

    await browser.close();

    if (hl) {
        if (!fs.existsSync(highlight_path)) fs.mkdirSync(highlight_path);

        const getHighlights = logger({
            text: "[GETTING HIGHLIGHTS]",
            spinner
        }).start();

        const highlights = await get_highlights_srcs(await get_highlights(res.logging_page_id.replace("profilePage_", ""), cookies), cookies);

        getHighlights.succeed("[GOT HIGHLIGHTS]");

        const downloadHighlights = logger({
            text: "[DOWNLOADING HIGHLIGHTS]",
            spinner
        }).start();

        const downloadedhighlights = await download(highlights);

        downloadHighlights.succeed("[DOWNLOADED HIGHLIGHTS]");

        const saveHighlights = logger({
            text: "[SAVING HIGHLIGHTS]",
            spinner
        }).start();

        const qtds = [...new Set(downloadedhighlights.map((x) => x.title))].reduce((o, key) => ({ ...o, [key]: 0 }), {});

        for (let i = 0; i < downloadedhighlights.length; i++) {
            if (!fs.existsSync(path.join(highlight_path, downloadedhighlights[i].title))) fs.mkdirSync(path.join(highlight_path, downloadedhighlights[i].title));

            const filename = path.join(highlight_path, path.join(downloadedhighlights[i].title, String(qtds[downloadedhighlights[i].title]++) + downloadedhighlights[i].extension));
            fs.writeFileSync(filename, Buffer.from(downloadedhighlights[i].data));
        }

        saveHighlights.succeed("[SAVED HIGHLIGHTS]");
    }

    process.exit();
}

console.clear();

const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

input.question("[USERNAME]: ", download_posts_from_instagram);

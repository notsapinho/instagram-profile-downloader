const request = require("request");
const async = require("async");
const path = require("path");
const fs = require("fs");
const url = require("url");

class Downloader {
    constructor(client) {
        this.client = client;

        this.q = async.queue(this.singleFile, 1);

        this.q.error(function (err, task) {
            console.error("ERROR PLEASE REPORT AT THE GITHUB:", task);
        });
    }

    downloadFiles(links) {
        for (let link of links) {
            this.q.push(link);
        }
    }

    singleFile({ link, client, type, i, dir, title }, cb) {
        const file = request(link);
        const extension = path.extname(url.parse(link).pathname);
        file.on("response", (res) => {
            file.on("end", () => {
                client.log.text = client.bar.tick(1);
                cb();
            });
        });
        if (title) {
            if (!fs.existsSync(path.join(dir, title))) fs.mkdirSync(path.join(dir, title));
            file.pipe(fs.createWriteStream(path.join(path.join(dir, title), String(i) + extension)));
        } else file.pipe(fs.createWriteStream(path.join(dir, String(i) + extension)));
    }
}

module.exports = Downloader;

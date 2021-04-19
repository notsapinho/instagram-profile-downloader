import * as request from "request";
import async, { QueueObject } from "async";
import * as path from "path";
import * as fs from "fs";
import InstagramClient from "./InstagramClient";

export default class Downloader {
    public q: QueueObject<any>;
    public client: InstagramClient;

    constructor(client) {
        this.client = client;

        this.q = async.queue((task, cb) => {
            return this.singleFile(task, cb);
        }, 1);

        this.q.error((err, task) => {
            console.error("ERROR PLEASE REPORT AT THE GITHUB:", task);
        });
    }

    downloadFiles(links: object[]) {
        for (let link of links) {
            this.q.push(link);
        }
    }

    singleFile({ src, i, len, dir, title, type }: { src: string; i: number; len: number; dir: string; title: string; type: string }, cb: any) {
        const file = request(src);
        const extension = path.extname(new URL(src).pathname);
        file.on("response", (res) => {
            file.on("end", () => {
                this.client.bars[type === "POSTS" ? 0 : 1].bar.update({ progress: (i + 1) / len, title: `${type} [${i + 1}/${len}]:` });
                cb();
            });
        });
        if (title) {
            if (!fs.existsSync(path.join(dir, title))) fs.mkdirSync(path.join(dir, title));
            file.pipe(fs.createWriteStream(path.join(path.join(dir, title), String(i) + extension)));
        } else file.pipe(fs.createWriteStream(path.join(dir, String(i) + extension)));
    }
}

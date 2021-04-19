import { IgApiClient, ReelsMediaFeedResponseItem, UserFeedResponseItemsItem, UserRepositorySearchResponseUsersItem, UserRepositoryInfoResponseUser } from "instagram-private-api";
import * as fs from "fs";
import * as path from "path";
import { terminal } from "terminal-kit";
import { ProgressBarController } from "terminal-kit/Terminal";
import Downloader from "./Downloader";

interface InstagramClientOptions {
    storeSession?: boolean;
    sessionPath?: string;
    dir_path?: string;
}

interface Bar {
    bar: ProgressBarController;
    id: number;
}

export default class InstagramClient {
    public ig: IgApiClient;
    public storeSession: boolean;
    public sessionPath: string;
    public downloader: Downloader;
    public bars: Bar[];
    public dir_path: string;

    constructor(options?: InstagramClientOptions) {
        this.ig = new IgApiClient();
        this.downloader = new Downloader(this);

        this.bars = [];
        this.storeSession = options?.storeSession || true;
        this.sessionPath = options?.sessionPath || "./session.json";
        this.dir_path = options?.dir_path || "./downloads";
    }

    async login(username: string, password: string) {
        if (!username || !password) {
            terminal.red("^+[❌]^ USERNAME OR PASSWORD NOT INFORMED!\n");
            process.exit();
        }

        this.ig.state.generateDevice(username);

        const hasSession = await this.handleSession();

        await this.ig.simulate.preLoginFlow();

        if (!hasSession)
            await this.ig.account.login(username, password).catch((e) => {
                terminal.red("^+[❌]^ INVALID USERNAME OR PASSWORD!\n");
                process.exit();
            });

        process.nextTick(async () => await this.ig.simulate.postLoginFlow());
    }

    async downloadPostsByUsername(user: UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser, limit?: number | string) {
        const download_path = path.join(this.dir_path, user.username);

        if (!fs.existsSync(download_path)) fs.mkdirSync(download_path);

        const posts = await this.getUserPostsSrcs(user, limit);

        this.bars.push({
            id: this.bars.length + 1,
            bar: terminal.progressBar({
                width: 80,
                title: `POSTS [0/${posts.length}]:`,
                titleSize: 15,
                eta: true,
                percent: true
            })
        });

        this.downloader.downloadFiles(posts.map((src, i) => ({ src, dir: download_path, i, len: posts.length, type: "POSTS" })));

        await this.downloader.q.drain();

        if (this.bars.length > 1) console.log("\n");
    }

    async downloadHighlightsByUsername(user: UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser, limit?: number | string) {
        const download_path = path.join(this.dir_path, user.username);

        if (!fs.existsSync(download_path)) fs.mkdirSync(download_path);

        const highlights = await this.getUserHighlightsSrcs(user, limit);

        this.bars.push({
            id: this.bars.length + 1,
            bar: terminal.progressBar({
                width: 80,
                title: `HIGHLIGHTS [0/${highlights.length}]:`,
                titleSize: 23,
                eta: true,
                percent: true
            })
        });

        this.downloader.downloadFiles(highlights.map(({ src, title }, i) => ({ title, src, dir: download_path, i, len: highlights.length, type: "HIGHLIGHTS" })));

        await this.downloader.q.drain();    
    }

    async getUserHighlightsSrcs(user: UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser, limit?: number | string) {
        const highlights = await this.getUserHighlights(user, limit);

        const srcs = [];

        for (let i = 0; i < highlights.length; i++) {
            srcs.push(this.handleMediaType(highlights[i]));
        }
        //@ts-ignore
        return srcs.flat().map((_, i) => ({ title: highlights[i].highlight_id, src: _ }));
    }

    handleMediaType(curr: UserFeedResponseItemsItem | ReelsMediaFeedResponseItem) {
        if (curr.media_type === 8) {
            //@ts-ignore
            return curr.carousel_media.map((o) => this.handleMediaType(o));
        } else if (curr.media_type === 2) {
            return curr.video_versions.find((o) => o.type === Math.max(...curr.video_versions.map((o) => o.type), 0)).url;
        } else {
            return curr.image_versions2.candidates[0].url;
        }
    }

    async getUserPostsSrcs(user: UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser, limit?: number | string) {
        const posts = await this.getUserPosts(user, limit);
        const srcs = [];

        for (let i = 0; i < posts.length; i++) {
            srcs.push(this.handleMediaType(posts[i]));
        }

        return srcs.flat();
    }

    async getUserHighlights(user: UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser, limit?: number | string): Promise<ReelsMediaFeedResponseItem[]> {
        const tray = await this.ig.highlights.highlightsTray(user.pk);
        const media = this.ig.feed.reelsMedia({ userIds: tray.tray.map((x) => x.id) });
        const highlights = await media.items();

        while (media.isMoreAvailable()) {
            highlights.push(...(await media.items()));
        }

        if (limit) highlights.splice(Number(limit));

        let pseudoI = 0;

        return highlights.map((high) => {
            pseudoI++;

            //@ts-ignore
            high.highlight_id = tray.tray[0].id.split(":")[1];

            if (pseudoI > tray.tray[0].media_count) {
                tray.tray.shift();
                pseudoI = 0;
            }

            return high;
        });
    }

    async getUserPosts(user: UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser, limit?: number | string): Promise<UserFeedResponseItemsItem[]> {
        const feed = this.ig.feed.user(user.pk);
        const posts = await feed.items();

        while (feed.isMoreAvailable()) {
            posts.push(...(await feed.items()));
        }

        if (limit) posts.splice(Number(limit));

        return posts;
    }

    async getUserByIdOrUsername(pk: string | number): Promise<UserRepositorySearchResponseUsersItem | UserRepositoryInfoResponseUser> {
        return typeof pk === "string" && isNaN(Number(pk)) ? await this.ig.user.searchExact(pk).catch((e) => null) : await this.ig.user.info(pk).catch((e) => null);
    }

    async handleSession() {
        this.ig.request.end$.subscribe(async () => {
            const serialized = await this.ig.state.serialize();
            delete serialized.constants;
            fs.writeFileSync(this.sessionPath, JSON.stringify(serialized));
        });

        if (fs.existsSync(this.sessionPath)) {
            await this.ig.state.deserialize(JSON.parse(fs.readFileSync(this.sessionPath, { encoding: "utf8" })));
            return true;
        }

        return false;
    }
}

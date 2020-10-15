const fetch = require("node-fetch");

class Scraper {
    constructor(client) {
        this.client = client;
    }

    async get_highlights_from_instagram() {
        const highlights = await this.get_highlights();

        return await this.get_highlights_srcs(highlights);
    }

    async get_posts_from_instagram() {
        const posts = await this.client.page.evaluate(this.get_posts_hrefs, 3000);

        if (!posts.length) {
            console.log("[NO POSTS]");
            process.exit();
        }

        return await this.get_srcs_from_posts(posts);
    }

    async get_srcs_from_posts(posts) {
        const srcs = [];

        for (let i = 0; i < posts.length; i++) {
            const href = posts[i];

            const res = await (await fetch(`${href}?__a=1`, { headers: { Cookie: this.client.cookies } })).json();

            if (res.graphql.shortcode_media.edge_sidecar_to_children) {
                srcs.push(res.graphql.shortcode_media.edge_sidecar_to_children.edges.map((x) => (x.node.is_video ? x.node.video_url : x.node.display_url)));
            } else if (res.graphql.shortcode_media.is_video && !res.graphql.shortcode_media.edge_sidecar_to_children) {
                srcs.push(res.graphql.shortcode_media.video_url);
            } else {
                srcs.push(res.graphql.shortcode_media.display_url);
            }
        }

        return srcs.flat();
    }

    async get_posts_hrefs(timeout) {
        let urls = [];
        let time = 0;
        let height = 0;

        while (time < timeout / 100) {
            window.scrollTo(0, document.body.scrollHeight);

            await new Promise((resolve) => setTimeout(resolve, 100));
            time++;

            if (height != document.body.scrollHeight) {
                height = document.body.scrollHeight;
                time = 0;
            }

            document.querySelectorAll(".v1Nh3.kIKUG._bz0w > a").forEach((post) => {
                if (urls.indexOf(post.href) == -1) {
                    urls.push(post.href);
                }
            });
        }

        return urls;
    }

    async get_highlights_srcs(stories) {
        const res = await (
            await fetch(
                `https://www.instagram.com/graphql/query/?query_hash=90709b530ea0969f002c86a89b4f2b8d&variables={"reel_ids":[],"tag_names":[],"location_ids":[],"highlight_reel_ids":${JSON.stringify(
                    stories
                )},"precomposed_overlay":false,"show_story_viewer_list":false,"story_viewer_fetch_count":0,"story_viewer_cursor":"","stories_video_dash_manifest":false}`,
                {
                    method: "GET",
                    headers: {
                        "x-ig-capabilities": "3w==",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:81.0) Gecko/20100101 Firefox/81.0",
                        Host: "i.instagram.com",
                        Cookie: this.client.cookies
                    }
                }
            )
        ).json();

        return res.data.reels_media.map((x) => ({ title: x.id, srcs: x.items.map((y) => (y.is_video ? y.video_resources[0].src : y.display_url)).flat() }));
    }

    async get_highlights() {
        const res = await (
            await fetch(
                `https://www.instagram.com/graphql/query/?query_hash=d4d88dc1500312af6f937f7b804c68c3&variables={"user_id":"${this.client.id}","include_chaining":false,"include_reel":false,"include_suggested_users":false,"include_logged_out_extras":false,"include_highlight_reels":true,"include_related_profiles":false}`,
                {
                    method: "GET",
                    headers: {
                        "x-ig-capabilities": "3w==",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:81.0) Gecko/20100101 Firefox/81.0",
                        Host: "i.instagram.com",
                        Cookie: this.client.cookies
                    }
                }
            )
        ).json();

        if (!res.data.user) {
            console.log("[NO HIGHLIGHTS]");
            process.exit();
        }

        return res.data.user.edge_highlight_reels.edges.map((x) => x.node.id);
    }
}

module.exports = Scraper;

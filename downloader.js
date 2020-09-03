const fetch = require("node-fetch");

async function download_posts(posts_src) {
    const posts = [];

    for (let i = 0; i < posts_src.length; i++) {
        posts.push(await get_data_from(posts_src[i]));
    }

    return posts;
}

async function get_data_from(url) {
    const response = await fetch(url);

    const data = await response.arrayBuffer();
    const extension = "." + response.headers.get("content-type").split("/")[1];

    return { data: data, extension: extension };
}

async function get_posts_from_instagram(page, timeout = 3000) {
    const posts = await page.evaluate(get_posts_hrefs, timeout);

    return await download_posts(await get_srcs_from_posts(posts));
}

async function get_srcs_from_posts(posts) {
    const srcs = [];

    for (let i = 0; i < posts.length; i++) {
        const href = posts[i];

        const res = await (await fetch(`${href}?__a=1`)).json();

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

async function get_posts_hrefs(timeout) {
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

module.exports = get_posts_from_instagram;

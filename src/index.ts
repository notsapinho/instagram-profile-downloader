import "dotenv/config";
import "colors";
import { terminal } from "terminal-kit";
import InstagramClient from "./classes/InstagramClient";

(async () => {
    terminal.clear();

    const client = new InstagramClient();

    await client.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);

    terminal.brightCyan("Please enter the username ^+>^ ");

    const username = await terminal.inputField({}).promise;

    const user = await client.getUserByIdOrUsername(username);

    if (!user) {
        terminal.red("^+[❌]^ COULDN'T FIND THAT USER!\n");
        process.exit();
    }

    const option = await terminal.singleColumnMenu(["POSTS AND HIGHLIGHTS", "ONLY POSTS", "ONLY HIGHLIGHTS"], { selectedLeftPadding: "> ", selectedStyle: terminal.bgWhite.black, submittedStyle: terminal.green, submittedLeftPadding: "> " }).promise;

    if (option.selectedIndex === 0) {
        terminal.brightCyan("Please enter the limit for posts (0 for all) ^+>^ ");
        let limitUser = Number(await terminal.inputField({}).promise);
        if (isNaN(limitUser)) limitUser = 0;
        console.log("\n");
        terminal.brightCyan("Please enter the limit for highlights (0 for all) ^+>^ ");
        let limitHigh = Number(await terminal.inputField({}).promise);
        if (isNaN(limitHigh)) limitHigh = 0;
        console.log("\n");
        await Promise.all([client.downloadPostsByUsername(user, limitUser), client.downloadHighlightsByUsername(user, limitHigh)]);
    } else if (option.selectedIndex === 1) {
        terminal.brightCyan("Please enter the limit (0 for all) ^+>^ ");
        let limit = Number(await terminal.inputField({}).promise);
        if (isNaN(limit)) limit = 0;
        console.log("\n");
        await client.downloadPostsByUsername(user, limit);
    } else {
        terminal.brightCyan("Please enter the limit (0 for all) ^+>^ ");
        let limit = Number(await terminal.inputField({}).promise);
        if (isNaN(limit)) limit = 0;
        console.log("\n");
        await client.downloadHighlightsByUsername(user);
    }

    process.exit();
})();

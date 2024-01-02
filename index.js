const { getInput, notice, setFailed } = require("@actions/core");
const { context, getOctokit } = require("@actions/github");
const { readFileSync } = require("fs");

const run = async () => {
    const content = getInput("content", {
        trimWhitespace: false,
    });
    const contentIsFilePath = getInput("contentIsFilePath");
    const regex = getInput("regex") || "---.*";
    const regexFlags = getInput("regexFlags") || "";
    const appendContentOnMatchOnly = getInput("appendContentOnMatchOnly");
    const token = getInput("token", { required: true });

    const { owner, repo } = context.repo;
    const octokit = getOctokit(token);

    let prNumber = context.payload.pull_request?.number;
    if (!prNumber) {
        // not a pull_request event, try and find the PR number from the commit sha
        const { data: pullRequests } =
            await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
                owner,
                repo,
                commit_sha: context.sha,
            });

        const candidatePullRequests = pullRequests.filter(
            (pr) =>
                context.payload.ref === `refs/heads/${pr.head.ref}` &&
                pr.state === "open",
        );

        prNumber = candidatePullRequests?.[0]?.number;
    }

    if (!prNumber) {
        setFailed(
            `No open pull request found for ${context.eventName}, ${context.sha}`,
        );
        return;
    }

    const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    let body = data.body;

    let output = content;
    if (contentIsFilePath && contentIsFilePath === "true") {
        output = readFileSync(content).toString("utf-8");
    }

    const re = RegExp(regex, regexFlags);
    if (body && body.match(re)) {
        notice("Replacing regex matched content in PR body");
        let a = body.replace(re, output);
        let b = a.replaceAll('\n', '').replaceAll('mleko', 'dzik');
        console.log(body)
        console.log("----------------")
        console.log(a)
        console.log("----------------")

        console.log(b)
        console.log("----------------")

        body = b;
        // body = body.replace(re, output).replace(/\n\n/img, '\n');
        // body = 'test'
    } else if (body && appendContentOnMatchOnly !== "true") {
        notice("Append content to PR body");
        body += output;
    } else if (appendContentOnMatchOnly !== "true") {
        notice("Setting PR body to content");
        body = output;
    } else {
        notice(
            `No match found and appendContentOnMatchOnly is set, not updating PR body`,
        );
        return;
    }

    await octokit.rest.pulls.update({
        owner,
        repo,
        body: body,
        pull_number: prNumber,
    });
};

run().catch((error) => setFailed(error.message));

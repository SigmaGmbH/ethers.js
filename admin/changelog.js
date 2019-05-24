"use strict";

const fs = require("fs");
const resolve = require("path").resolve;

const git = require("./git");
const local = require("./local");
const npm = require("./npm");
const utils = require("./utils");

const ChangelogPath = resolve(__dirname, "../CHANGELOG.md");

async function generate() {

    // Get each section of the Changelog
    let existing = fs.readFileSync(ChangelogPath).toString().split("\n");
    let sections = [ ];
    let lastLine = existing[0];
    existing.slice(1).forEach((line) => {
        if (line.substring(0, 5) === "=====" || line.substring(0, 5) === "-----") {
            sections.push({
                title: lastLine,
                underline: line.substring(0, 1),
                body: [ ]
            });
            lastLine = null;
            return;
        } else if (lastLine) {
            sections[sections.length - 1].body.push(lastLine);
        }
        lastLine = line;
    });
    sections[sections.length - 1].body.push(lastLine);

    let lastVersion = await npm.getPackageVersion("ethers");

    let logs = await git.run([ "log", (lastVersion.gitHead + "..") ]);

    let changes = [ ];
    logs.split("\n").forEach((line) => {
        if (line.toLowerCase().substring(0, 6) === "commit") {
            changes.push({
                commit: line.substring(6).trim(),
                body: [ ]
            });
        } else if (line.toLowerCase().substring(0, 5) === "date:") {
            changes[changes.length - 1].date = utils.getDateTime(new Date(line.substring(5).trim()));
        } else if (line.substring(0, 1) === " ") {
            line = line.trim();
            if (line === "") { return; }
            changes[changes.length - 1].body += line + " ";
        }
    });

    // @TODO:
    // ethers/version ([date](tag))
    let newSection = {
        title: "ethers/" + local.loadPackage("ethers").version,
        underline: "-",
        body: [ ]
    }

    // Delete duplicate sections for the same version (ran update multiple times)
    while (sections[1].title === newSection.title) {
        sections.splice(1, 1);
    }

    changes.forEach((change) => {
        let body = change.body.trim();
        let link = body.match(/(\((.*#.*)\))/)
        if (link) {
            body = body.replace(/ *(\(.*#.*)\) */, "");
            link = link[2] + "; " + change.commit;
        } else {
            link = change.commit;
        }
        newSection.body.push(`  - ${body} (${link})`);
    });

    sections.splice(1, 0, newSection);


    let formatted = [ ];
    sections.forEach((section) => {
        formatted.push(section.title);
        formatted.push(utils.repeat(section.underline, section.title.length));
        formatted.push("");
        section.body.forEach((line) => {
            line = line.trim();
            if (line === "") { return; }
            if (line.substring(0, 1) === "-") {
                line = "- " + line.substring(1).trim();
            }
            if (section.underline === "-") {
                line = "  " + line;
            }
            formatted.push(line);
        });
        formatted.push("");
    });

    return formatted.join("\n") + "\n";
}

module.exports = {
    generate: generate,
    ChangelogPath: ChangelogPath,
}


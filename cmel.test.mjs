import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, lstatSync } from "node:fs";

const EXPECT_STRING = "// expect:";
const EXPECT_ERROR_STRING = "// expect error:";

process.on("unhandledRejection", (reason, _promise) => {
    console.error(reason);
    throw reason;
});

function execRun(cmd) {
    let stdout, stderr;
    try {
        stdout = execSync(cmd, { stdio: ['ignore'] }).toString();
    } catch (e) {
        stderr = e.stderr.toString();
    }
    return { stdout, stderr };
}

function unescapeNewLines(str) {
    return str.replaceAll('\\n', '\n');
}

function generateAssertions(str, stdout, stderr) {
    str.split("\n").forEach((line) => {
        if (line.startsWith(EXPECT_STRING)) {
            const expectedString = unescapeNewLines(line.substring(EXPECT_STRING.length + 1));
            assert.equal(stdout, expectedString + "\n");
        } else if (line.startsWith(EXPECT_ERROR_STRING)) {
            const expectedError = unescapeNewLines(line.substring(EXPECT_ERROR_STRING.length + 1));
            assert.equal(stderr, expectedError + "\n");
        }
    });
}

function loadFile(fileName) {
    it(fileName, async () => {
        const fileContent = readFileSync(fileName, "utf8");
        const { stdout, stderr } = execRun("./cmel " + fileName);
        generateAssertions(fileContent, stdout, stderr);
    });
}

function readDirectory(path) {
    describe(path, () => {
        for (const file of readdirSync(path)) {
            const filePath = path + "/" + file;

            if (lstatSync(filePath).isDirectory()) {
                readDirectory(filePath);
            } else if (lstatSync(filePath).isFile()) {
                loadFile(filePath);
            } else {
                throw new Error(
                    'Attempted to read "' +
                    filePath +
                    '" which is neither a directory or a file.'
                );
            }
        }
    });
}

readDirectory("test");
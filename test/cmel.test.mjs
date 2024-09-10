import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';

function execRun(cmd) {
    return new Promise((resolve, _reject) => {
        exec(cmd, (error, stdout, stderr) => {
            resolve({error, stdout, stderr});
        });
    });
}

describe("cmel", () => {
    it("should execute basic multiplication", async () => {
        const {err, stdout, stderr} = await execRun("../cmel multiplication.cmel");
        assert.equal(stdout, "10\n");
    });

    it("should throw error with missing semicolon", async () => {
        const data = readFileSync('missing_semicolon.cmel', 'utf-8');
        console.log(data);
        const {err, stdout, stderr} = await execRun("../cmel missing_semicolon.cmel");
        assert.equal(stderr, "[line 1] Error at end: Expect ';' after value.\n");
    });

    it("should assign to variables and read from them", async () => {
        const {err, stdout, stderr} = await execRun("../cmel var_declarations.cmel");
        assert.equal(stdout, "caramel fiona\n");
    });
});
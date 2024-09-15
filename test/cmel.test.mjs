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

async function expectError(file, error) {
    const {err, stdout, stderr} = await execRun('../cmel ' + file);
    assert.equal(stderr, error + '\n');
}

async function expect(file, output) {
    const {err, stdout, stderr} = await execRun('../cmel ' + file);
    assert.equal(stdout, output + '\n');
}

describe('cmel', async () => {
    it('should execute basic multiplication', async () => {
        expect('multiplication.cmel', '10');
    });

    it('should throw error with missing semicolon', async () => {
        expectError('missing_semicolon.cmel', '[line 1] Error at end: Expect \';\' after value.');
    });

    it('should assign to variables and read from them', async () => {
        expect('var_declarations.cmel', 'caramel fiona');
    });

    describe('local_variables', async () => {
        it('should introduce local variables at each scope with parent scopes visible', async () => {
            expect('local_variables/scopes.cmel', '3');
        });

        it('should throw error when redefining an existing local variable', async () => {
            expectError('local_variables/duplicate_locals.cmel', '[line 3] Error at \'a\': Already a variable with this name in this scope.');
        });

        it('should throw error when defining a variable in terms of itself', async () => {
            expectError('local_variables/define_variable_with_itself.cmel', '[line 2] Error at \'a\': Can\'t read local variable in its own initializer.')
        });
    });

    describe('if', async () => {
        it('should do if block and jump over else', async () => {
            expect('if/do_if.cmel', 'x is 10');
        });

        it('should do if block and jump over else', async () => {
            expect('if/do_else.cmel', 'x is 10');
        });
    });
});
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

    describe('logical_operators', async () => {
        it('should perform and expression', async () => {
            expect('logical_operators/and.cmel', 'yay');
        });

        it('should perform or expression', async () => {
            expect('logical_operators/or.cmel', 'yay');
        });
    });

    describe('for', async () => {
        it('should execute initializer, condition, and increment', async () => {
            expect('for/for.cmel', '8');
        });
    });

    describe('while', async () => {
        it('should reproduce for functionality', async () => {
            expect('while/while.cmel', '5')
        });
    });

    describe('break', async () => {
        it('should break from a while loop', async () => {
            expect('break/while.cmel', '0\n1\n2\nend');
        });

        it('should break from an inner while loop', async () => {
            expect('break/nested_while.cmel', '0\n2\n4\n6\n8\nend');
        });

        it('should throw error when break is outside of a loop', async () => {
            expectError('break/break_outside_loop.cmel', '[line 1] Error at \'break\': Cannot use \'break\' outside of a loop.');
        });

        it('should break from a for loop', async () => {
            expect('break/for.cmel', '0\n1\n2\n3\nend');
        });

        it('should break from an inner for loop', async () => {
            expect('break/nested_for.cmel', '0\n2\n4\n6\n8\nend');
        });
    });
});
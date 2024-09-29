import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';

process.on('unhandledRejection', (reason, promise) => {
    console.error(reason);
    throw reason;
  });
  
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
        await expect('multiplication.cmel', '10');
    });

    it('should throw error with missing semicolon', async () => {
        await expectError('missing_semicolon.cmel', '[line 1] Error at end: Expect \';\' after value.');
    });

    it('should assign to variables and read from them', async () => {
        await expect('var_declarations.cmel', 'caramel fiona');
    });

    describe('local_variables', async () => {
        it('should introduce local variables at each scope with parent scopes visible', async () => {
            await expect('local_variables/scopes.cmel', '3');
        });

        it('should throw error when redefining an existing local variable', async () => {
            await expectError('local_variables/duplicate_locals.cmel', '[line 3] Error at \'a\': Already a variable with this name in this scope.');
        });

        it('should throw error when defining a variable in terms of itself', async () => {
            await expectError('local_variables/define_variable_with_itself.cmel', '[line 2] Error at \'a\': Can\'t read local variable in its own initializer.')
        });
    });

    describe('if', async () => {
        it('should do if block and jump over else', async () => {
            await expect('if/do_if.cmel', 'x is 10');
        });

        it('should do if block and jump over else', async () => {
            await expect('if/do_else.cmel', 'x is 10');
        });
    });

    describe('logical_operators', async () => {
        it('should perform and expression', async () => {
            await expect('logical_operators/and.cmel', 'yay');
        });

        it('should perform or expression', async () => {
            await expect('logical_operators/or.cmel', 'yay');
        });
    });

    describe('for', async () => {
        it('should execute initializer, condition, and increment', async () => {
            await expect('for/for.cmel', '8');
        });
    });

    describe('while', async () => {
        it('should reproduce for functionality', async () => {
            await expect('while/while.cmel', '5')
        });
    });

    describe('break', async () => {
        it('should break from a while loop', async () => {
            await expect('break/while.cmel', '0\n1\n2\nend');
        });

        it('should break from an inner while loop', async () => {
            await expect('break/nested_while.cmel', '0\n2\n4\n6\n8\nend');
        });

        it('should throw error when break is outside of a loop', async () => {
            await expectError('break/break_outside_loop.cmel', '[line 1] Error at \'break\': Cannot use \'break\' outside of a loop.');
        });

        it('should break from a for loop', async () => {
            await expect('break/for.cmel', '0\n1\n2\n3\nend');
        });

        it('should break from an inner for loop', async () => {
            await expect('break/nested_for.cmel', '0\n2\n4\n6\n8\nend');
        });
    });

    describe('functions', async () => {
        it('should declare variables and be able to print them', async () => {
            await expect('functions/function_declarations.cmel', '<fn myFirstFunction>');
        });

        it('should call functions', async () => {
            await expect('functions/function_calls.cmel', 'this is a!\nthis is b!');
        });

        it('should throw a meaningful stack trace', async () => {
            await expectError('functions/stack_trace.cmel', 'Expected 0 arguments but got 1.\n[line 2] in c\n[line 7] in b\n[line 12] in a\n[line 15] in script');
        });
    });

    describe('closures', async () => {
        it('should capture enclosing functions variable', async () => {
            await expect('closures/closure.cmel', 'outer');
        });

        it('should break out of a loop in a closure', async () => {
            await expect('closures/break.cmel', 'outer');
        });
    });

    describe('classes', async () => {
        it('should create a declaration of a class', async () => {
            await expect('classes/class.cmel', 'Saturn');
        });

        it('should create an instance of a class', async () => {
            await expect('classes/instance.cmel', 'Saturn instance');
        });
    });
});
/*
    MIT License
    
    Copyright (c) 2023-2025 Yvain Ramora
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

const argv = require('minimist')(process.argv.slice(2));
const highlight = require('cli-highlight').highlight;
const babel = require('@babel/core');
const cluster = require('cluster');
const chalk = require('chalk');
const repl = require('repl');
const os = require('os');
const fs = require('fs');

const help = `
Usage:
    -h                Display the help menu
    -i <filename>     Specify the input file
    -o <filename>     Specify the output file
    -r                Launch REPL with preloaded code
    -v                Enable verbose mode
    -l                Display software licensing information
    --no-colors       Disable colorized output


Example:
    node ${process.argv[1].split('\\').at(-1)} -i input.js -o output.js -v
    node ${process.argv[1].split('\\').at(-1)} -i input.js -r
`;

const theme = {
    keyword: chalk.hex('#569CD6'),
    built_in: chalk.hex('#50B9FE'),
    string: chalk.hex('#C3602D'),
    number: chalk.hex('#B5AD61'),
    literal: chalk.hex('#569CD6'),
    function: chalk.hex('#C5C800'),
    params: chalk.hex('#9CDCF0').italic,
    title: chalk.hex('#DCDCAA'),
    comment: chalk.hex('#5E993E').italic,
};
  

/* checks that it is the master process */
if (cluster.isMaster) {
    if (argv.h) {

        /* displays the help menu */
        console.log(help);
    } else if (argv.l) {

        /* displays the license */
        console.log(fs.readFileSync('LICENSE', 'utf-8'));
    } else if (argv.i) {


        /* check if the input file exists */
        if (fs.existsSync(argv.i)) {

            console.log('deobfuscation in progress...');
            argv.v && console.log(`Number of cores available: ${os.cpus().length}`);

            /* read the input file */
            const code = fs.readFileSync(argv.i, 'utf-8');

            /* run the main function with the obfuscated code */
            main(code);
        } else {
            console.error('You must provide a valid input file.');
        }
    } else {
        console.error('Please specify arguments, use -h for help');
    }
} else {

    /* run the worker to deobfuscate a chunk */
    startWorker();
}

/* the main function for deobfuscate JSDefender */
function main(code) {

    /* retrieves the name of the very first variable, which will contain all the obfuscated values */
    const obfuscatedLetName = code.match(/let[\x20]+[0-9A-Z]+;/i)[0].match(/[A-Z0-9]+/gi)[1];

    /* retrieves all the eval arguments used in the obfuscated code */
    const obfuscatedEvals = evalParser(code);

    /* retrieves the main eval which gives all the obfuscated values to the first variable in the program */
    const mainEval = obfuscatedEvals.shift();

    /* reconstructs the main code used to obtain the obscured values */
    const mainCode = 'const ' + mainEval[0] + ' = Array.prototype.slice.call(arguments);eval(' + mainEval[1] + ');';

    if (argv.r) {

        /* loads the REPL console */
        loadREPL(mainCode, obfuscatedLetName);
    } else {

        /* goes through the de-obfuscation process  */
        deobfuscate(code, obfuscatedLetName, mainCode, obfuscatedEvals);
    }
}

/* run a worker to deobfuscate chunk */
function startWorker() {

    /* listens to messages sent by the master process */
    process.on('message', ({ mainCode, obfuscatedLetName, chunkObfuscatedEvals, chunkObfuscatedValues, chunkObfuscatedExpressions }) => {

        /* merge the global object with additional runtime objects for execution */
        const possible_objects = Object.assign({}, global, {
            console, Math, Date, Array, ArrayBuffer, BigInt, BigInt64Array, BigUint64Array,
            Boolean, DataView, Error, EvalError, Float32Array, Float64Array, Function, Infinity,
            Intl, JSON, Map, NaN, Number, Object, Promise, Proxy, RangeError, ReferenceError,
            Reflect, RegExp, Set, SharedArrayBuffer, String, Symbol, SyntaxError, TypeError,
            URIError, WeakMap, WeakSet, globalThis, process, Buffer, require, module, exports,
            __dirname, __filename, setImmediate, clearImmediate
        });
    
        /* executes the main code sent to load the obfuscation core */
        exec(mainCode);

        /* dictionaries containing obfuscated and deobfuscated values */
        let resultDeobfuscatedEvals = {};
        let resultDeobfuscatedValues = {};
        let resultDeobfuscatedExpressions = {};

        /* runs each obfuscated evaluation in the received chunk */
        chunkObfuscatedEvals && chunkObfuscatedEvals.forEach(value => {
            try {

                /* extraction of functions and arguments required for decryption */
                const mainFunction = value[1].match(/f.*;}}/i)[0];
                const callFunctionToDecrypt = value[1].match(/[A-Z0-9]+\.[A-Z0-9]+\([A-Z0-9]+,[A-Z0-9]+\.[A-Z0-9]+\([A-Z0-9]+\.toString\(\)\)\)/i)[0];
                const cryptedFunction = value[1].match(/".*"/)[0];

                /* decrypts the obfuscated function */
                const decryptedFunction = exec('const ' + value[0] + '=Array.prototype.slice.call(arguments);' + callFunctionToDecrypt.match(/[A-Z0-9]+/gi)[2] + '=' + cryptedFunction + ';' + mainFunction + ';' + callFunctionToDecrypt);

                /* adds the decrypted function to the results */
                resultDeobfuscatedEvals['eval("' + value[1].replaceAll('\'', '\\\'').replaceAll('"', '\\"') + '")'] = decryptedFunction;

                /* analyses the decrypted code to identify new values and expressions to be processed */
                chunkObfuscatedValues.push(...getObfuscatedValues(decryptedFunction, obfuscatedLetName));
                chunkObfuscatedExpressions.push(...getObfuscatedExpression(decryptedFunction));
            } catch {

                /* error handling in the event of decryption failure */
                console.error(`Error decrypting function:\n${highlight(value, { language: 'javascript', theme: theme})}`, err);
            }
        });

        /* evaluation of obfuscated values to replace them with readable equivalents */
        chunkObfuscatedValues && chunkObfuscatedValues.forEach(value => {
            try {

                /* evaluates the obfuscated value */
                const newValue = eval(value);

                if (typeof newValue == 'object') {

                    /* identifies known global objects corresponding to the de-buffered value */
                    const keys = Object.keys(possible_objects);
                    for (let i = 0; i < keys.length; i++) {
                        if (possible_objects[keys[i]] == newValue) {
                            resultDeobfuscatedValues[value] = keys[i];
                            break;
                        }
                    }
                } else if(typeof newValue == 'function') {

                    /* use function name if available */
                    resultDeobfuscatedValues[value] = newValue.name !== 'bound ' && newValue.name.replace('bound ', '');
                } else {

                    /* adds a readable version of non-object or non-function values */
                    resultDeobfuscatedValues[value] = typeof newValue === 'string' ? `"${newValue.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : newValue;
                }
            } catch (err) {

                /* error handling when evaluating a value */
                console.error(`Error when evaluating ${value}:`, err);
            }
        });

        /* evaluation of obfuscated mathematical expressions */
        chunkObfuscatedExpressions && chunkObfuscatedExpressions.forEach(value => {
            const newValue = eval(value);
            try {
                if (typeof newValue == 'number') {

                    /* adds the result of the expression if it is a number */
                    resultDeobfuscatedExpressions[value] = newValue;
                }
            } catch {
                
                /* error handling when evaluating an expression */
                console.error(`Error when evaluating ${value}:`, err);
            }
        });

        /* sends the unblinded results to the main process (master) */
        process.send({ resultDeobfuscatedEvals, resultDeobfuscatedValues, resultDeobfuscatedExpressions });
    });
}

/* function to extracting information about calls to eval in the source code. */
function evalParser(code) {

    /* initializes an array to store data extracted from calls to 'eval'. */
    const extractedData = [];

    /* uses Babel to transform and analyse given source code */
    babel.transformSync(code, {
        compact: false,
        plugins: [() => {
            return {
                visitor: {

                    /* visitor for call expressions (CallExpression) */
                    CallExpression(path) {

                        /* checks whether the call concerns the 'eval' function */
                        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'eval') {

                            /* retrieves the arguments passed to 'eval' */
                            const args = path.node.arguments.map(arg => arg.type === 'StringLiteral' && arg.value);

                            let variableName = null;
                            const parentBody = path.parentPath.parent.body;

                            /* checks whether the parentBody is an array */
                            if (Array.isArray(parentBody)) {
                                const evalIndex = parentBody.indexOf(path.parent);
                                if (evalIndex > 0) {

                                    /* look for a variable declaration just before the 'eval' call */
                                    const previousNode = parentBody[evalIndex - 1];
                                    if (previousNode.type === 'VariableDeclaration' && previousNode.declarations.length === 1) {
                                        const declaration = previousNode.declarations[0];
                                        if (declaration.id.type === 'Identifier') {
                                            variableName = declaration.id.name;
                                        }
                                    }
                                }
                            }

                            /* adds the extracted data (variable name and 'eval' argument) to the array */
                            extractedData.push([variableName, args[0]]);
                        }
                    }
                }
            };
        }]
    });

    return extractedData;
}

/* function to load a REPL console with the obfuscation values */
function loadREPL(code, obfuscatedLetName) {
    console.log(`Welcome to Node.js ${process.version}\nType ".help" for more information.\nNOTE: the obfuscation values are in the '${obfuscatedLetName}' variable.`);
    const replServer = repl.start('> ');
    replServer.context[obfuscatedLetName] = exec(code + obfuscatedLetName);
}

/* function to deobfuscate a code */
function deobfuscate(code, obfuscatedLetName, mainCode, obfuscatedEvals) {

    /* calculates the time taken by the de-obfuscation process */
    const startTime = new Date();

    /* retrieves the number of processor cores for the cluster */
    const numCPUs = os.cpus().length;

    /* retrieves all parts that call on the obfuscated values in the obfuscated program */
    const obfuscatedValues = getObfuscatedValues(code, obfuscatedLetName);

    /* recovers all mathematical expressions made more complex by obfuscation  */
    var obfuscatedExpression = getObfuscatedExpression(code);
    
    /* separates all the values obtained for each processor core */
    const chunksObfuscatedEvals = createChunks(obfuscatedEvals, Math.ceil(obfuscatedEvals.length / numCPUs));
    const chunksObfuscatedValues = createChunks(obfuscatedValues, Math.ceil(obfuscatedValues.length / numCPUs));
    const chunksObfuscatedExpressions = createChunks(obfuscatedExpression, Math.ceil(obfuscatedExpression.length / numCPUs));

    let completedWorkers = 0;

    /* dictionaries containing obfuscated and deobfuscated values */
    let deobfuscatedEvals = {};
    let deobfuscatedValues = {};
    let deobfuscatedExpressions = {};

    /* loop to deobfuscate each part */
    for (let i = 0; i < numCPUs; i++) {

        /* creates a worker process to process part of the data */
        const worker = cluster.fork();
        
        /* retrieves data chunks specific to this worker */
        const chunkObfuscatedEvals = chunksObfuscatedEvals[i];
        const chunkObfuscatedValues = chunksObfuscatedValues[i];
        const chunkObfuscatedExpressions = chunksObfuscatedExpressions[i];


        /* sends the worker an object containing the main code, the name of the obfuscated variable and the parts of the data to be processed */
        worker.send({ mainCode, obfuscatedLetName, chunkObfuscatedEvals, chunkObfuscatedValues, chunkObfuscatedExpressions });


        /* listen to workers' messages containing deobfuscation results */
        worker.on('message', async (result) => {

            var { resultDeobfuscatedEvals, resultDeobfuscatedValues, resultDeobfuscatedExpressions } = result;
            
            /* combines worker results with overall results  */
            Object.assign(deobfuscatedEvals, resultDeobfuscatedEvals);
            Object.assign(deobfuscatedValues, resultDeobfuscatedValues);
            Object.assign(deobfuscatedExpressions, resultDeobfuscatedExpressions);

            completedWorkers++;

            /* checks if all workers have completed their tasks */
            if (completedWorkers === numCPUs) {

                /* initialise a copy of the obfuscated code to be updated */
                let updatedCode = code;

                /* replaces each part of the obfuscated code with the unobfuscated code */
                
                Object.entries(deobfuscatedEvals).forEach(([value, newValue]) => {
                    updatedCode = updatedCode.replaceAll(value, newValue);
                    argv.v && console.log(argv.colors ? highlight(newValue, { language: 'javascript', theme: theme}) : newValue);
                });

                Object.entries(deobfuscatedValues).forEach(([value, newValue]) => {
                    updatedCode = updatedCode.replaceAll(value, newValue);
                    argv.v && console.log(argv.colors ? value + ' = \x1b[' + (typeof newValue == 'string' ? '32m' : '33m') + newValue + '\x1b[0m' : value + ' = ' + newValue);
                });

                Object.entries(deobfuscatedExpressions).forEach(([value, newValue]) => {
                    updatedCode = updatedCode.replaceAll(value, newValue);
                    argv.v && console.log(argv.colors ? value + ' = \x1b[33m' + newValue + '\x1b[0m' : value + ' = ' + newValue);
                });
                
                console.log('code cleaning...');

                /* beautifies the final code to make it readable */
                updatedCode = await beautify(updatedCode);

                /* checks if an output file has been specified */
                if (argv.o) {

                    /* saves the deobfuscated code in the specified file */
                    fs.writeFile(argv.o, updatedCode, () => {
                        console.log('the code has been successfully deobfuscated!');
                        const endTime = new Date();
                        const timeTaken = endTime - startTime;
                        console.log(`elapsed time : ${timeTaken} ms`);
                    });
                } else {

                    /* displays the deobfuscated code in the console */
                    console.log(argv.colors ? highlight(updatedCode, { language: 'javascript', theme: theme}) : updatedCode);
                }
            }
        });
    }
}

/* executes JavaScript code in Node.js with mocked browser-like globals for compatibility. */
function exec(code) {

    /* define global mock objects to emulate a browser environment */
    global.window = global.window || {};
    global.self = global.self || {};
    global.document = global.document || {};
    global.navigator = global.navigator || {};
    global.location = global.location || {};
    global.history = global.history || {};
    global.localStorage = global.localStorage || {};
    global.sessionStorage = global.sessionStorage || {};
    global.alert = global.alert || function() {};
    global.fetch = global.fetch || function() {};
    global.XMLHttpRequest = global.XMLHttpRequest || function() {};
    global.Event = global.Event || function() {};
    global.CustomEvent = global.CustomEvent || function() {};
    global.Worker = global.Worker || function() {};
    global.EventSource = global.EventSource || function() {};
    global.WebSocket = global.WebSocket || function() {};
    global.performance = global.performance || {};
    global.crypto = global.crypto || {};
    global.File = global.File || function() {};
    global.FileReader = global.FileReader || function() {};
    global.Blob = global.Blob || function() {};
    global.URL = global.URL || function() {};
    global.URLSearchParams = global.URLSearchParams || function() {};
    global.FormData = global.FormData || function() {};
    global.MutationObserver = global.MutationObserver || function() {};
    global.ResizeObserver = global.ResizeObserver || function() {};
    global.IntersectionObserver = global.IntersectionObserver || function() {};
    global.screen = global.screen || {};
    global.Image = global.Image || function() {};
    global.CanvasRenderingContext2D = global.CanvasRenderingContext2D || function() {};
    global.AudioContext = global.AudioContext || function() {};
    global.HTMLCanvasElement = global.HTMLCanvasElement || function() {};

    /* use eval to execute the provided code in this simulated environment */
    return eval(code);
}

/* function to get the obfuscated values in the code */
function getObfuscatedValues(code, obfuscatedLetName) {
    return [
        ...new Set(code.match(new RegExp(obfuscatedLetName + '\\[' + obfuscatedLetName + '\\.[0-9A-Z]+\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)\\]\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)', 'gi'))),
        ...new Set(code.match(new RegExp(obfuscatedLetName + '\\.[0-9A-Z]+\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)', 'gi'))),
        ...new Set(code.match(new RegExp(obfuscatedLetName + '\\[\\"[0-9A-Z]+\\"\\]\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)', 'gi')))
    ];
}

/* function to get the obfuscated expressions in the code */
function getObfuscatedExpression(code) {
    return [
        ...new Set(code.match(/\(([\x20]+|)(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)([\x20]+|)([+\-*/%^&|]{1,2}([\x20]+|)(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)([\x20]+|))+\)/gi))
    ];
}

/* function to dividing an array into chunks */
function createChunks(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/* function to beautify code with babel */
async function beautify(data) {
    try {
        const result = await babel.transformAsync(data, {
            presets: ['@babel/preset-env'],
            plugins: ['transform-member-expression-literals'],
            compact: false,
        });
        return result.code;
    } catch {
        return data;
    }
}

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        `${/*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               \`*-.                    
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                )  _`-.                 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               .  : `. .                
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               : _   '  \               
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ; *` _.   `*-._          
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               `-.-'          `-.       
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ;       `       `.     
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 :.       .        \    
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 . \  .   :   .-'   .   
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 '  `+.;  ;  '      :   
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 :  '  |    ;       ;-. 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ; '   : :`-:     _.`* ;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              .*' /  .*' ; .*`- +'  `*' 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              `*-*   `*-*  `*-*'
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        */'hi :)'}`
/*
MIT License 
  
 Copyright (c) 2023 Yvain Ramora
  
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

/* importing modules */
const argv = require("minimist")(process.argv.slice(2));
const bf = require("js-beautify");
const { VM } = require("vm2");
const fs = require("fs");

/* js-beautify parameters */
const bfConfig = {
    "indent_size": 2,
    "indent_char": " ",
    "indent_with_tabs": false,
    "preserve_newlines": true,
    "max_preserve_newlines": 2,
    "space_in_paren": true,
    "e4x": true,
    "jslint_happy": true,
    "brace_style": "collapse",
    "keep_array_indentation": false,
    "keep_function_indentation": false,
    "space_after_anon_function": true,
    "space_before_conditional": true,
    "unescape_strings": false,
    "wrap_line_length": 0
}

/* reading the input file */
if (argv.i && argv.o) {
    if (fs.existsSync(argv.i)) {
        fs.readFile(argv.i, "utf8", (err, data) => {
            if (!err) {
                
               /* calls the deob function */
                var unobfuscated = deob(data);
                  
                /* write the unobfuscated code to the output file */
                fs.writeFile(argv.o, unobfuscated, (err) => {
                    if (!err) {
                        console.log("\x1b[32mThe input file has been successfully deobfuscated!\x1b[0m");
                    } else {
                        console.log("\x1b[31mError: An error has occurred while writing the output file.\x1b[0m");
                    }
                })
            } else {
                console.log("\x1b[31mError: An error has occurred while reading the input file.\x1b[0m");
            }
        })
    } else {
        console.log("\x1b[31mError: You must provide a valid input file.\x1b[0m");
    }
} else {
    console.log("\x1b[31mError: You need to provide an input file and an output file!\n\x1b[33mexample: node deobfuscator.js --i input.js --o output.js\x1b[0m");
}

/* returns the unobfuscated code */
function deob(data) {

    /* launches the vm */
    const vm = new VM({
        sandbox: {
            'String': String,
            'decodeURI': decodeURI,
        }
    });

    /* finds important values */
    var obfLetName = data.match(/let[\x20]+[0-9A-Z]+;/i);
    var obfToValues = data.match(/eval\("[\W\D\S]+\\"\)"\)/i);

    if (obfLetName && obfToValues) {
        var obfLetName = obfLetName[0].match(/[0-9A-Z]+/gi)[1];
        var evalContent = obfToValues[0].replace(/eval\("/, '').replace(/\\/g, '').slice(0, -2);
        var hashFunction = evalContent.match(/function [0-9A-Z]+\([0-9A-Z]+\){let [0-9A-Z]+=(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+);.*String.fromCharCode\(\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)[+\-*/%^&]{1,2}(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)\)\+[0-9A-Z]+\);}break;case \((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)[+\-*/%^&]{1,2}(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)\):[0-9A-Z]+=\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)[+\-*/%^&]{1,2}(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)\);[0-9A-Z]+[+\-*/%^&]{1,2};break;}}}return [0-9A-Z]+;}/i);
        var decryptFunction = evalContent.match(/function [0-9A-Z]+\([0-9A-Z]+,[0-9A-Z]+\){[0-9A-Z]+=decodeURI\([0-9A-Z]+\);.*[0-9A-Z]+=\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)[+\-*/%^&]{1,2}(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)\);[0-9A-Z]+[+\-*/%^&]{1,2};break;}}}return [0-9A-Z]+;}/i);
        var mainFunction = evalContent.match(/function [0-9A-Z]+\([0-9A-Z]+\){const [0-9A-Z]+=[0-9A-Z]+\([0-9A-Z]+,[0-9A-Z]+\([0-9A-Z]+\.toString\(\)\)\);.*;break;}}}return [0-9A-Z]+;}}/i);

        if (mainFunction && decryptFunction && hashFunction) {
            var key = vm.run('var mainFunction = \"' + mainFunction[0].replace(/"/g, '\\"') + '\";' + hashFunction[0].replace(/const/g, 'var') + ';' + hashFunction[0].match(/[0-9A-Z]+/gi)[1] + '(mainFunction);');
            var core = vm.run(decryptFunction[0].replace(/const/g, 'var') + ';' + decryptFunction[0].match(/[0-9A-Z]+/gi)[1] + '(' + evalContent.replace('(' + mainFunction[0] + ')(', '').slice(0, -1) + ',"' + key + '")');

            /* displays console information */
            console.log("key = \x1b[32m\"" + key + "\"\x1b[0m");

            /* deleting unnecessary data */
            var nData = data.match(/}\(\);[\W\D\S]+/i);
            if (nData) {
                data = nData[0].replace('}();', '');
            } else {
                console.log("\x1b[33mError: An error has occurred while deleting unnecessary values, deobfuscation continues.\x1b[0m");
            }

            /* recovers obfuscated values */
            vm.sandbox.obfValues = [
                ...new Set(data.match(new RegExp(obfLetName + '\\[' + obfLetName + '\\.[0-9A-Z]+\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)\\]\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)', 'gi'))),
                ...new Set(data.match(new RegExp(obfLetName + '\\.[0-9A-Z]+\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)', 'gi'))),
                ...new Set(data.match(new RegExp(obfLetName + '\\[\\"[0-9A-Z]+\\"\\]\\((0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+|)\\)', 'gi'))),
            ];

            /* recovering unobfuscated values */
            vm.run('var ' + obfLetName + ';' + core + '();' + "var deobValues = {}; obfValues.forEach(value => deobValues['' + value] = eval(value))");

            /* replacing obfuscated values */
            vm.sandbox.obfValues.forEach(value => {
                var newValue = typeof vm.sandbox.deobValues['' + value] == 'string' ? '"' + vm.sandbox.deobValues['' + value] + '"' : vm.sandbox.deobValues['' + value];
                data = data.replace(new RegExp(value.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)'), 'g'), newValue);
                console.log(value + " = \x1b[" + (typeof newValue == 'string' ? '32m' : '33m') + newValue + '\x1b[0m');
            });

            /* solves the calculations */
            var calcs = data.match(/\(([\x20]+|)(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)([\x20]+|)[+\-*/%^&]{1,2}([\x20]+|)(0x[0-9A-F]+|0b[01]+|(0o|0)[0-7]+|[0-9]+)([\x20]+|)\)/gi);
            if (calcs) {
                calcs.forEach(calc => {
                    try {
                        var result = vm.run(calc);
                        if (typeof result == 'number') {
                            data = data.replace(calc, result);
                            console.log(calc + " = \x1b[33m" + result + "\x1b[0m");
                        }
                    } catch {}
                });
            }

            /* renames variables */
            var varNames = [...new Set(data.match(/[\u15E0-\u1770]{4}|[\u2AF8-\u2E18]{4}/g))];
            if (varNames) {
                varNames.forEach(varName => {
                    var newName = "";
                    for (let i = 0; i < 4; i++) newName += String.fromCharCode(Math.floor(Math.random() * 26) + [0x41, 0x61][Math.floor(Math.random() * 2)]);
                    data = data.replace(new RegExp(varName, 'g'), newName);
                })
            }

            /* better visibility of the algorithm */
            for (let skip = -1; skip < 0;) {
                var uncleans = data.match(/[0-9A-Z]+\["[0-9A-Z]+"\]/gi);
                if (uncleans) {
                    uncleans.forEach(unclean => {
                        data = data.replace(unclean, unclean.match(/[0-9A-Z]+/gi)[0] + '.' + unclean.match(/[0-9A-Z]+/gi)[1]);
                    });
                } else {
                    skip = 1;
                }
            }
            var uncleanJsons = data.match(/\[\"[0-9A-Z]+\"\]\:/gi)
            if (uncleanJsons) {
                uncleanJsons.forEach(uncleanJson => {
                    data = data.replace(uncleanJson, uncleanJson.match(/\"[0-9A-Z]+\"/i) + ':');
                });
            }

            /* returns the unobfuscated code */
            return bf(data, bfConfig);
        } else {
            console.log("\x1b[31mError: An error has occurred in the structure of the code. If you are sure that your algorithm is correctly structured, please open an issue\x1b[0m");
            return bf(data, bfConfig);
        }
    } else {
        console.log("\x1b[31mError: A problem has occurred when retrieving important values. Check that the code is not corrupted and that it is obfuscated by JSDefender.\x1b[0m");
        return bf(data, bfConfig);
    }
}

/* Project created with ❤️ */


/**     @module/Function fauxmongo/lib/Project

@argument/Object document
@argument/Object projection
*/

var getTypeStr = require ('./GetTypeStr');
var resolveDollar = require ('./ResolveDollar');
var matchQuery = require ('./MatchQuery');

function project (document, query, projection) {
    if (!projection) {
        projection = query;
        query = undefined;
    }

    var outputDoc = {};
    var dollarPath;
    var previousStep, previousPPointer;
    for (var path in projection) {
        // in case we traverse any Arrays during this projection
        function multiproject (pointer, target, path) {
            var pointerType = getTypeStr (pointer);
            var mainTarget;
            if (target)
                mainTarget = target;
            else
                if (pointerType == 'object')
                    target = {};
                else if (pointerType == 'array') {
                    target = [];
                    var remainingPath = path.slice (i);
                    for (var i in pointer) {
                        var found = multiproject (pointer[i], target[i], remainingPath);
                        if (found !== undefined)
                            target[i] = found;
                    }
                    return target;
                } else
                    return;

            for (var i=0,j=path.length-1; i<j; i++) {
                var pathStep = path[i];
                if (pathStep == '$')
                    throw new Error (
                        'cannot use the positional operator inside another Array'
                    );

                if (pointerType == 'array') {
                    if (!mainTarget) mainTarget = target;
                    var remainingPath = path.slice (i);
                    for (var k in pointer) {
                        var found = multiproject (pointer[k], target[k], remainingPath);
                        if (found !== undefined)
                            target[k] = found;
                    }
                    return mainTarget;
                } else if (pointerType != 'object')
                    return mainTarget; // if there's path left, we must be a container type

                if (!Object.hasOwnProperty.call (pointer, pathStep))
                    return mainTarget; // not found
                if (!mainTarget) mainTarget = target;
                pointer = pointer[pathStep];
                pointerType = getTypeStr (pointer);

                if (Object.hasOwnProperty.call (target, pathStep))
                    target = target[pathStep];
                else
                    if (pointerType == 'object')
                        target = target[pathStep] = {};
                    else
                        target = target[pathStep] = [];
            }

            var finalStep = path[path.length-1];
            if (!mainTarget) mainTarget = target;

            if (pointerType == 'array') {
                for (var k in pointer) {
                    var found = multiproject (pointer[k], target[k], [ finalStep ]);
                    if (found !== undefined)
                        target[k] = found;
                }
                return mainTarget;
            } else if (pointerType != 'object')
                return mainTarget;

            if (Object.hasOwnProperty.call (pointer, finalStep)) {
                target[finalStep] = pointer[finalStep];
                if (!mainTarget) mainTarget = target;
            }
            return mainTarget;
        }

        var directive = projection[path];

        // walk the document to the projected leaves, if able
        var pointer = document;
        var ppointer = outputDoc;
        var pathFrags = path.split ('.');
        var broken = false;
        var pointerType = 'object';
        for (var i=0,j=pathFrags.length-1; i<j; i++) {
            if (pointer === undefined) {
                broken = true; // projected key not available because it is missing
                break;
            }
            if (dollarPath && pathFrags.slice (0, i+1).join ('.') == dollarPath) {
                // clobbered by dollarPath
                // KEYWORD we could speed this up
                broken = true;
                break;
            }

            var pathStep = pathFrags[i];

            // positional operator
            if (pathStep == '$') {
                if (pointerType != 'array')
                    throw new Error ('positional operator requires an Array');
                if (!query)
                    throw new Error ('positional operator requires an query');
                if (dollarPath)
                    throw new Error ('cannot use the positional operator on more than one Array');

                var dollarFrags = pathFrags.slice (0, i);
                dollarPath = dollarFrags.join ('.');
                var dollarPosition = resolveDollar (document, query, dollarFrags, dollarPath);
                if (dollarPosition < 0) { // could not resolve - not found
                    broken = true;
                    break;
                }
                previousPPointer[previousStep] = [ pointer[dollarPosition] ];
                broken = true;
                break;
            }

            // array multiprojection
            if (pointerType == 'array') {
                var remainingPath = pathFrags.slice (i);
                for (var i in pointer) {
                    var docfrag = multiproject (pointer[i], ppointer[i], remainingPath);
                    if (docfrag !== undefined)
                        ppointer[i] = docfrag;
                }
                broken = true;
                break;
            }

            // walk the pointer
            previousPPointer = ppointer;
            previousStep = pathStep;
            pointer = pointer[pathStep];
            pointerType = getTypeStr (pointer);

            // walk ppointer, or infill
            if (Object.hasOwnProperty.call (ppointer, pathStep))
                ppointer = ppointer[pathStep];
            else
                if (pointerType == 'object')
                    ppointer = ppointer[pathStep] = {};
                else if (pointerType == 'array')
                    ppointer = ppointer[pathStep] = [];
                else { // this is an intermediate frag so, a.$.b but the elem $ isn't a container
                    broken = true;
                    break;
                }
        }
        if (broken) // projected key was unavailable, we already processed it, whatever
            continue;

        var finalStep = pathFrags[pathFrags.length-1];

        // array multiprojection

        if (finalStep != '$')
            if (pointerType != 'array')
                pointer = pointer[finalStep];
            else {
                for (var i in pointer) {
                    var docfrag = multiproject (pointer[i], ppointer[i], [ finalStep ]);
                    if (docfrag !== undefined)
                        ppointer[i] = docfrag;
                }
                continue
            }
        else {
            if (pointerType != 'array')
                throw new Error ('positional operator requires an Array');
            if (!query)
                throw new Error ('positional operator requires an query');
            if (dollarPath)
                throw new Error ('cannot use the positional operator on more than one Array');

            var dollarFrags = pathFrags.slice (0, i);
            dollarPath = dollarFrags.join ('.');
            var dollarPosition = resolveDollar (document, query, dollarFrags, dollarPath);
            if (dollarPosition < 0) // could not resolve - not found
                continue
            previousPPointer[previousStep] = [ pointer[dollarPosition] ];
            continue;
        }

        // simple projection? { a.b.c:1 }
        if (
            !Object.hasOwnProperty.call (directive, '$elemMatch')
         && !Object.hasOwnProperty.call (directive, '$slice')
        ) {
            if (pointer !== undefined) {
                var leafTypeStr = getTypeStr (pointer);
                if (leafTypeStr != 'array')
                    ppointer[finalStep] = pointer;
                else {
                    var newCloneArr = ppointer[finalStep] = [];
                    newCloneArr.push.apply (newCloneArr, pointer);
                }
            }

            continue;
        }

        // complex projection
        if (!(pointer instanceof Array))
            continue;

        // $elemMatch
        if (directive.$elemMatch) {
            ppointer = ppointer[finalStep] = [];
            for (var k in pointer)
                if (matchQuery (pointer[k], directive.$elemMatch)) {
                    ppointer.push (pointer[k]);
                    break;
                }
            continue;
        }

        // $slice
        if (directive.$slice) {
            if (directive.$slice instanceof Number)
                if (directive.$slice >= 0)
                    ppointer[finalStep] = pointer.slice (0, directive.$slice);
                else
                    ppointer[finalStep] = pointer.slice (directive.$slice);
            else if (!(directive.$slice instanceof Array))
                throw new Error ('$slice requires an Array of boundary indices');
            ppointer[finalStep] = pointer.slice (
                directive.$slice[0],
                directive.$slice[0] + directive.$slice[1]
            );

            continue;
        }

        throw new Error ('unsupported query option '+JSON.stringify (directive));
    }

    return outputDoc;
}

module.exports = project;

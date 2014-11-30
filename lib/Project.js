
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
    var dollarPath, dollarPosition;
    for (var path in projection) {
        var directive = projection[path];

        // walk the document to the projected leaves, if able
        var pointer = document;
        var ppointer = outputDoc;
        var pathFrags = path.split ('.');
        var broken = false;
        var pointerType;
        for (var i=0,j=pathFrags.length-1; i<j; i++) {
            if (pointer === undefined) {
                broken = true; // projected key not available because it is missing
                break;
            }
            var pathStep = pathFrags[i];
            if (pathStep == '$') {
                if (pointerType != 'array')
                    throw new Error ('positional operator requires an Array');
                if (!query)
                    throw new Error ('positional operator requires an query');
                if (!dollarPath) {
                    var dollarFrags = pathFrags.slice (0, i);
                    dollarPath = dollarFrags.join ('.');
                    dollarPosition = resolveDollar (document, query, dollarFrags, dollarPath);
                } else if (pathFrags.slice (0, i).join ('.') != dollarPath)
                    throw new Error ('cannot use the positional operator on more than one Array');
                pointer = pointer[dollarPosition];
                pointerType = getTypeStr (pointer);
                if (pointerType == 'object')
                    ppointer.push (ppointer = {});
                else if (pointerType == 'array')
                    ppointer.push (ppointer = []);
                else { // this is an intermediate frag so, a.$.b but the elem $ isn't a container
                    broken = true;
                    break;
                }
                continue;
            }

            pointer = pointer[pathStep];
            pointerType = getTypeStr (pointer);
            if (pointerType == 'object')
                ppointer = ppointer[pathStep] = {};
            else if (pointerType == 'array')
                ppointer = ppointer[pathStep] = [];
            else { // this is an intermediate frag so, a.$.b but the elem $ isn't a container
                broken = true;
                break;
            }
        }

        if (broken) // projected key was unavailable for whatever reason
            continue;

        var finalStep = pathFrags[pathFrags.length-1];
        if (finalStep != '$')
            pointer = pointer[finalStep];
        else {
            if (pointerType != 'array')
                throw new Error ('positional operator requires an Array');
            if (!query)
                throw new Error ('positional operator requires a query');
            if (!dollarPath) {
                var dollarFrags = pathFrags.slice (0, -1);
                dollarPath = dollarFrags.join ('.');
                dollarPosition = resolveDollar (document, query, dollarFrags, dollarPath);
            } else if (pathFrags.slice (0, -1).join ('.') != dollarPath)
                throw new Error ('cannot use the positional operator on more than one Array');

            pointer = pointer[dollarPosition];
            finalStep = 0;
            // continue;
        }

        // simple projection? { a.b.c:1 }
        if (
            !Object.hasOwnProperty.call (directive, '$elemMatch')
         && !Object.hasOwnProperty.call (directive, '$slice')
        ) {
            if (pointer !== undefined)
                ppointer[finalStep] = pointer;
            continue;
        }

        // complex projection
        if (!(pointer instanceof Array))
            continue;

        if (directive.$elemMatch) {
            ppointer = ppointer[finalStep] = [];
            for (var k in pointer)
                if (matchQuery (pointer[k], directive.$elemMatch))
                    ppointer.push (pointer[k]);
            continue;
        }

        // $slice
        if (!(directive.$slice instanceof Array))
            throw new Error ('$slice requires an Array of boundary indices');
        ppointer[finalStep] = pointer.slice (directive.$slice[0], directive.$slice[1]);
    }

    return outputDoc;
}

module.exports = project;

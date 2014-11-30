
/**     @module/Function fauxmongo/lib/MatchQuery
    @api
    Determine whether a query selects a given document.
@argument/Object doc
@argument/Object query
@returns/Boolean
*/
function matchQuery (doc, query) {
    for (var path in query) {
        if (path == '$where')
            throw new Error ('$where is not supported');

        var subquery = query[path];
        var subtype = getTypeStr (query[path]);

        if (path == '$and') {
            if (subtype != 'array')
                throw new Error ('$and requires an Array of query documents');
            for (var i=0,j=subquery.length; i<j; i++)
                if (!matchQuery (doc, subquery[i]))
                    return false;
            continue;
        }

        if (path == '$or') {
            if (subtype != 'array')
                throw new Error ('$or requires an Array of query documents');
            var fullfilled = false;
            for (var i=0,j=subquery.length; i<j; i++)
                if (matchQuery (doc, subquery[i])) {
                    fullfilled = true;
                    break;
                }
            if (!fullfilled) return false;
            continue;
        }

        if (path == '$nor') {
            if (subtype != 'array')
                throw new Error ('$nor requires an Array of query documents');
            for (var i=0,j=subquery.length; i<j; i++)
                if (matchQuery (doc, subquery[i]))
                    return false;
            continue;
        }

        var frags = path.split ('.');
        var pointer = doc;
        var pointerType = 'object';

        // iterate all but the last frag
        var ok = true;
        var earlyMatch = false; // for child-of-Array queries
        for (var i=0,j=frags.length-1; i<j; i++) {
            var frag = frags[i];
            if (frag[0] == '$') // operator in middle of path
                throw new Error ('invalid path '+path);

            if (pointerType == 'array') {
                var index = parseInt (frag);
                var upperSubpath = frags.slice (i+1).join ('.');
                if (!isNaN (index) && frag.match (/^\d+$/) && index < pointer.length) {
                    // possible numeric index match
                    var specialSubquery = {};
                    specialSubquery[upperSubpath] = subquery;
                    if (matchQuery (pointer[frag], specialSubquery)) {
                        earlyMatch = true;
                        break;
                    }
                }

                var fullfilled = false;
                upperSubpath = frag + '.' + upperSubpath;
                var specialSubquery = {};
                specialSubquery[upperSubpath] = subquery;
                for (var i in pointer)
                    if (matchQuery (pointer[i], specialSubquery)) {
                        fullfilled = true;
                        break;
                    }
                if (!fullfilled)
                    return false;
                earlyMatch = true;
                break;
            }

            if (pointerType != 'object')
                throw new Error ('Encountered a leaf in the middle of the path '+path);
            if (frag[0] == '$') // operator in middle of path
                throw new Error ('invalid path '+path);

            if (!Object.hasOwnProperty.call (pointer, frag)) {
                ok = false;
                break;
            }
            pointer = pointer[frag];
            pointerType = getTypeStr (pointer); // the business end of pointerType logic
        }
        if (earlyMatch) continue;

        // we have navigated to the parent of the last fragment in the path
        var frag = frags[frags.length-1];
        if (frag[0] == '$')
            throw new Error ('invalid path '+path);

        if (pointerType == 'array') {
            var index = parseInt (frag);
            var upperSubpath = frags.slice (i+1).join ('.');
            if (!isNaN (index) && frag.match (/^\d+$/) && index < pointer.length) {
                // possible numeric index match
                if (matchLeaves (pointer[frag], subquery)) {
                    earlyMatch = true;
                    break;
                }
            }

            var fullfilled = false;
            var specialSubquery = {};
            specialSubquery[frag] = subquery;
            for (var i in pointer)
                if (matchQuery (pointer[i], specialSubquery)) {
                    fullfilled = true;
                    break;
                }
            if (!fullfilled)
                return false;
            earlyMatch = true;
            break;
        }

        if (pointerType != 'object')
            throw new Error ('Encountered a leaf in the middle of the path '+path);

        // missing key?
        if (!ok || !Object.hasOwnProperty.call (pointer, frag))
            // still one thin ray of hope - $exists:false
            if (
                subtype == 'object'
             && Object.hasOwnProperty.call (subquery, '$exists')
             && !subquery.$exists
            )
                continue; // successfully matched { $exists:false }
            else
                return false; // missing key

        if (subtype != 'object' || !moreDollars (subquery))
            if (matchLeaves (pointer[frag], subquery))
                continue;
            else
                return false;

        // $operator-laden subquery
        for (var op in subquery) {
            // apply the operator
            if (op == '$exists') // we know it does
                continue;
            if (!operators.ops[op] (
                pointer,
                frag,
                subquery[op]
            ))
                return false;
        }
    }

    return true;
}

function matchSubquery (document, path, subquery) {
    // $operator-laden subquery
    for (var op in subquery) {
        // apply the operator
        if (op == '$exists') // we know it does
            continue;
        if (!operators.ops[op] (
            document,
            path,
            subquery[op]
        ))
            return false;
    }
    return true;
}

module.exports = matchQuery;
matchQuery.matchSubquery = matchSubquery;
var operators = require ('./QueryOperators');
var getTypeStr = require ('./GetTypeStr');
var moreDollars = require ('./MoreDollars');
var matchLeaves = require ('./MatchLeaves');

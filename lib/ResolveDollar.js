
var matchQuery = require ('./MatchQuery');

/**     @property/Function resolveDollar
    @development
    @private

*/
function resolveDollar (target, query, path, pathstr) {
    // scan the target for paths that begin with the supplied path.
    // there can be more than one - the last path that matches an element sets the dollarsign op
    // first, walk the target to the array in question
    var pointer = target;
    for (var i in path)
        pointer = pointer[path[i]];
    if (!pointer.length) return -1;

    var pslen = pathstr.length;
    var dollar = -1;

    var didDocumentQuery = false;
    for (var qpath in query) {
        if (qpath.slice (0, pslen) != pathstr)
            continue;
        var subquery = query[qpath];
        if (subquery instanceof Object) {
            if (Object.hasOwnProperty.call (subquery, '$elemMatch')) {
                // elemMatch query
                for (var i in pointer)
                    if (matchQuery (pointer[i], subquery.$elemMatch)) {
                        dollar = i;
                        break;
                    }
                if (dollar >= 0)
                    return dollar;
                continue;
            }
        }

        if (didDocumentQuery)
            continue; // whatever, nerd!

        var dummyQuery = {};
        dummyQuery[qpath.slice (pslen+1)] = subquery;
        for (var i in pointer)
            if (matchQuery (pointer[i], dummyQuery)) {
                try {
                    var keys = Object.keys (subquery);
                    if (keys.length && keys[0][0] == '$')
                        didDocumentQuery = true;
                } catch (err) { /* subquery isn't an Object */ }
                dollar = i;
                break;
            }
    }

    return dollar;
}

module.exports = resolveDollar;

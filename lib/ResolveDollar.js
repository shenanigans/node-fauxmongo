
var matchQuery = require ('./MatchQuery');

/**     @property/Function fauxmongo.resolveDollar
    @root
    @development
    Determine the numeric index, if any, of a value matching the positional operator. The prefix
    path where the positional operator was found is required, e.g. `comments.$.author` uses the path
    `comments`.

    Both `path` and `pathstr` are required (not generated) because if you are calling
    `resolveDollar` you probably have or need both of these anyway.
@argument/Object target
    The outer document to search. Must have the same root as the `path` and `pathstr` arguments.
@argument/Object query
    The query object used to generate the positional operator.
@argument/Array path
    The prefix path where the positional operator was found, as an Array of keys.
@argument/String pathstr
    The prefix path where the positional operator was found, as a dot-delimited String.
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

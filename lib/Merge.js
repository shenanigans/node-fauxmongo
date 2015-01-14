
/**     @module/Function fauxmongo.merge
    Recursively merge the result of a query into a local document, overwriting the document with
    fresh query results. A projection specification may be provided to intelligently merge
    projected fields.
@argument/Object source
    Freshly queried state information.
@argument/Object target
    The target document to recursively merge into.
@argument/Object query
    @optional
    If the projection uses the positional operator, the query may be included to define its
    position.
@argument/Object projection
    @optional
    If a projection is provided, the merge will honor any special projection options.
*/

var getTypeStr = require ('./GetTypeStr');
var resolveDollar = require ('./ResolveDollar');
var matchQuery = require ('./MatchQuery');

function simpleMerge (source, target) {
    for (var key in source) {
        var val = source[key];
        if (!Object.hasOwnProperty.call (target, key)) {
            target[key] = val;
            continue;
        }

        var childType = getTypeStr (val);
        var tval = target[key];
        var tvalType = getTypeStr (tval);
        if (childType != tvalType) {
            target[key] = val;
            continue;
        }
        if (childType == 'object')
            simpleMerge (val, tval);
        else if (childType == 'array')
            simpleArrayMerge (val, tval);
        else
            target[key] = val;
    }
}

function simpleArrayMerge (source, target) {
    for (var i in source) {
        var val = source[i];
        if (i >= target.length) {
            target.push (val);
            continue;
        }

        var childType = getTypeStr (val);
        var tval = target[i];
        var tvalType = getTypeStr (tval);
        if (childType != tvalType) {
            target[i] = val;
            continue;
        }
        if (childType == 'object')
            simpleMerge (val, tval);
        else if (childType == 'array')
            simpleArrayMerge (val, tval);
        else
            target[i] = val;
    }
}

function merge (source, target, query, projection) {
    if (!projection) {
        projection = query;
        query = undefined;
    }

    if (!projection) // merging with no projection is MUCH simpler
        return simpleMerge (source, target);

    // projected merge
    var dollarPath;
    function mergeLevel (subsource, subtarget, basePath) {
        for (var key in subsource) {
            var val = subsource[key];
            var childType = getTypeStr (val);
            var keypath = basePath ? basePath + '.' + key : key;

            if (!Object.hasOwnProperty.call (subtarget, key)) {
                if (childType != 'array')
                    subtarget[key] = val;
                else {
                    var newArr = subtarget[key] = [];
                    mergeArrayLevel (val, newArr, keypath);
                }
                continue;
            }

            var tval = subtarget[key];
            var tvalType = getTypeStr (tval);
            if (childType != tvalType) {
                subtarget[key] = val;
                continue;
            }
            if (childType == 'object')
                mergeLevel (val, tval, keypath);
            else if (childType == 'array')
                mergeArrayLevel (val, tval, keypath);
            else
                subtarget[key] = val;
        }
    }

    function mergeArrayLevel (subsource, subtarget, basePath) {
        if (!subsource.length)
            return;
        if (Object.hasOwnProperty.call (projection, basePath)) {
            // special projection?
            var directive = projection[basePath];
            if (typeof directive == 'object')
                if (directive.$elemMatch) {
                    for (var i in subtarget)
                        if (matchQuery (subtarget[i], directive.$elemMatch)) {
                            subtarget[i] = subsource[0];
                            return;
                        }
                    return;
                } else if (directive.$slice) {
                    // slice projection
                    var start, end, dropped;
                    if (typeof directive.$slice == 'number') {
                        if (directive.$slice < 0)
                            return; // cannot acquire a hard index for trailing elements
                        start = 0;
                        end = Math.min (subsource.length, directive.$slice);
                    } else {
                        // array of two indices
                        if (directive.$slice[0] < 0)
                            return;
                        start = directive.$slice[0];
                        end = start + directive.$slice[1];
                        dropped = (end - start) - subsource.length;
                    }

                    for (var i=0,j=start; j < end; j++, i++)
                        subtarget[j] = subsource[i];

                    if (dropped)
                        subtarget.splice (start + subsource.length, subtarget.length);

                    return;
                }
        } else if (Object.hasOwnProperty.call (projection, basePath+'.$')) {
            // positional operator projection
            if (dollarPath)
                throw new Error ('projection contains more than one positional operator');
            dollarPath = basePath;
            var dollarPosition = resolveDollar (target, query, basePath.split ('.'), basePath);
            if (dollarPosition >= 0)
                subtarget[dollarPosition] = subsource[0];
            return;
        }

        for (var i in subsource) {
            var val = subsource[i];
            if (i >= subtarget.length) {
                subtarget.push (val);
                continue;
            }

            var childType = getTypeStr (val);
            var tval = subtarget[i];
            var tvalType = getTypeStr (tval);
            if (childType != tvalType) {
                subtarget[i] = val;
                continue;
            }
            if (childType == 'object')
                mergeLevel (val, tval, basePath);
            else if (childType == 'array')
                mergeArrayLevel (val, tval, basePath);
            else
                subtarget[i] = val;
        }
    }

    mergeLevel (source, target);
}

module.exports = merge;

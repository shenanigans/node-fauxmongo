
/**     @module/Function fauxmongo

@argument/Object query
    @optional
@argument/Object target
@argument/Object change
*/

var typeGetter = ({}).toString;
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object' && obj instanceof Buffer) return 'buffer';
    return tstr;
}

/**     @property/Function moreDollars
    @development
    @private
    Determine, recursively, whether an [Object]() or [Array]() contains any named properties
    starting with `"$"`.
@argument/Object|Array level
@argument/Boolean isArray
@argument/Boolean allowMod
    When a dollar key is found, check whether it is a modifier operator before throwing a fit. This
    affects only the current `level` and will not propogate recursively.
*/
function moreDollars (level, isArray) {
    if (isArray) {
        for (var i in level) if (moreDollars (level[i])) return true;
        return false;
    }
    for (var key in level) {
        if (key[0] == '$')
            return true;
        var item = level[key];
        var type = getTypeStr (item);
        if (type == 'object')
            if (moreDollars (item)) continue;
            else return true;
        if (type == 'array')
            if (moreDollars (item, true)) return true;
    }
    return false;
}

/**     @property/Function matchLeaves

@argument/Object|Array|Number|String|Buffer|Boolean|Date|RegExp|undefined able
@argument/Object|Array|Number|String|Buffer|Boolean|Date|RegExp|undefined baker
@returns Boolean
*/
function matchLeaves (able, baker) {
    if (able === baker) return true;

    var aType = getTypeStr (able);
    var bType = getTypeStr (baker);
    if (aType != bType) return false;
    if (aType == 'array') {
        if (able.length != baker.length) return false;
        for (var i in able)
            if (!matchLeaves (able[i], baker[i]))
                return false;
        return true;
    } else if (aType == 'object') {
        if (Object.keys (able).length != Object.keys (baker).length) return false;
        for (var key in able)
            if (!Object.hasOwnProperty.call (baker, key) || !matchLeaves (able[key], baker[key]))
                return false;
        return true;
    } else return false;
}

/**     @property/Object QFIELD_OPS

*/
var QFIELD_OPS = {
    '$gt':          function $gt (pointer, path, query) {
        var val = pointer[path];
        if (typeof val != 'number' || typeof query != 'number' || val <= query)
            return false;
        return true;
    },
    '$gte':         function $gte (pointer, path, query) {
        var val = pointer[path];
        if (typeof val != 'number' || typeof query != 'number' || val < query)
            return false;
        return true;
    },
    '$in':          function $in (pointer, path, query) {
        if (getTypeStr (query) != 'array')
            throw new Error ('$in requires an Array');

        var val = pointer[path];
        var isString = typeof val == 'string';
        for (var i in query) {
            var subquery = query[i];
            if (getTypeStr (subquery == 'regexp')) {
                if (!isString) continue;
                else if (val.match (subquery))
                    return true;
            } else if (matchLeaves (query[i], val))
                return true;
        }
        return false;
    },
    '$lt':          function $lt (pointer, path, query) {
        var val = pointer[path];
        if (typeof val != 'number' || typeof query != 'number' || val >= query)
            return false;
        return true;
    },
    '$lte':         function $lte (pointer, path, query) {
        var val = pointer[path];
        if (typeof val != 'number' || typeof query != 'number' || val > query)
            return false;
        return true;
    },
    '$ne':          function $ne (pointer, path, query) {
        if (matchLeaves (pointer[path], query))
            return false;
        return true;
    },
    '$nin':         function $nin (pointer, path, query) {
        if (getTypeStr (query) != 'array')
            throw new Error ('$nin requires an Array');

        var val = pointer[path];
        var isString = typeof val == 'string';
        for (var i in query) {
            var subquery = query[i];
            if (getTypeStr (subquery == 'regexp')) {
                if (!isString) continue;
                else if (val.match (subquery))
                    return false;
            } else if (matchLeaves (query[i], val))
                return false;
        }
        return true;
    },
    '$mod':         function $mod (pointer, path, query) {
        if (getTypeStr (query) != 'array' || query.length != 2)
            throw new Error ('$in requires an Array of [ divisor, remainder ]');

        var val = pointer[path];
        if (typeof val != 'number') return false;

        if (val % query[0] == query[1])
            return true;
        return false;
    },
    '$regex':       function $regex (pointer, path, query) {
        if (getTypeStr (query) != 'regexp')
            throw new Error ('$regex requires a RegExp');

        var val = pointer[path];
        if (typeof val != 'string')
            return false;
        return val.match (query) ? true : false;
    },
    '$type':        function $type (pointer, path, query) {

    },
    '$where':       function $where (pointer, path, query) {
        if (typeof query != 'function')
            throw new Error ('$where requires a Function');
        return Boolean (query.call (pointer[path]));
    }
};

/**     @property/Object QARR_OPS

*/
var QARR_OPS = {
    '$all':         function $all (pointer, path, query) {

    },
    '$elemMatch':   function $elemMatch (pointer, path, query) {

    },
    '$size':        function $size (pointer, path, query) {

    }
};

/**     @property/Object QUERY_OPS

*/
var QUERY_OPS = {};
for (var key in QFIELD_OPS) QUERY_OPS[key] = QFIELD_OPS[key];
for (var key in QARR_OPS) QUERY_OPS[key] = QARR_OPS[key];

/**     @property/Function matchQuery
    Determine whether a query selects a given document.
@argument/Object doc
@argument/Object query
@returns Boolean
*/
function matchQuery (doc, query) {
    for (var path in query) {
        var frags = path.split ('.');
        var subquery = query[path];
        var subtype = getTypeStr (query[path]);
        var pointer = doc;
        var pointerType = 'object';

        // iterate all but the last frag
        var ok = true;
        for (var i=0,j=frags.length-1; i<j; i++) {
            if (pointerType != 'object' && pointerType != 'array')
                throw new Error ('Encountered a leaf in the middle of the path '+path);
            var frag = frags[i];
            if (frag[0] == '$') // operator in middle of path
                throw new Error ('invalid path '+path);

            if (!Object.hasOwnProperty (pointer, frag)) {
                ok = false;
                break;
            }
            pointer = pointer[frag];
            pointerType = getTypeStr (pointer); // the business end of pointerType logic
            continue;
        }

        // we have navigated to the parent of the last fragment in the path
        var frag = frags[frags.length-1];
        if (frag[0] == '$')
            throw new Error ('invalid path '+path);

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

        if (pointerType != 'object' && pointerType != 'array')
            throw new Error ('Encountered a leaf in the middle of the path '+path);

        for (var op in subquery) {
            // apply the operator
            if (op == '$exists') // we know it does
                continue;
            if (!QUERY_OPS[op] (
                pointer,
                frag,
                subquery[op]
            ))
                return false;
        }
    }

    return true;
}

/**     @property/Function matchRawQuery
    Determine whether a leaf matches a query leaf. e.g. if your document is
    `{ a:[ 1, 2, 3, 4, 5 ] }` and your query is `{ a:{ $gt:3 } }`, you might call
    `matchRawQuery (4, { $gt:3 })`.
*/
function matchRawQuery (leaf, query) {
    if (leaf === undefined) return false;
    var pointer = { id:leaf };
    for (var op in query) {
        // apply the operator
        if (op == '$exists') // we know it does
            continue;
        if (!QUERY_OPS[op] (
            pointer,
            'id',
            query[op]
        ))
            return false;
    }

    return true;
}

/**     @property/Function deepMatchWithoutDollars
    @development
    @private
    Evaluate two [Objects]() or [Arrays]() for deep equality, throwing an [Error]() if any key
    starting with `"$"` is found.
@argument/Object|Array able
@argument/Object|Array baker
@argument/Boolean isArray
*/
function deepMatchWithoutDollars (able, baker, isArray) {
    if (isArray) {
        if (able.length != baker.length) return false;
        for (var i in able) {
            var aType = getTypeStr (able);
            var bType = getTypeStr (baker);
            if (aType != bType) return false;
            if (aType != 'object' && aType != 'array') {
                if (able[i] !== baker[i]) return false;
            } else if (!deepMatchWithoutDollars (able[i], baker[i], aType == 'array'))
                return false;
        }
        return true;
    }

    if (Object.keys (able).length != Object.keys (baker).length)
        return false;

    for (var key in able) {
        if (key[0] == '$')
            throw new Error ('invalid property key in complex update');
        if (!Object.hasOwnProperty.call (baker, key))
            return false;

        var aType = getTypeStr (able[key]);
        var bType = getTypeStr (baker[key]);
        if (aType != bType) return false;
        if (aType != 'object' && aType != 'array') {
            if (able[key] !== baker[key]) return false;
        } else if (!deepMatchWithoutDollars (able[key], baker[key], aType == 'array'))
            return false;
    }
    return true;
}

var FIELD_OPS = {
    '$set':         function $set (pointer, path, change) {
        var changeType = getTypeStr (change);
        if (
            (changeType == 'object' && moreDollars (change))
         || (changeType == 'array' && moreDollars (change, true))
        )
            throw new Error ('invalid property key in complex update');

        pointer[path] = change;
    },
    '$inc':         function $inc (pointer, path, change) {
        if (getTypeStr (change) != 'number')
            throw new Error ('cannot $inc by a non-numeric value');
        if (!Object.hasOwnProperty.call (pointer, path))
            pointer[path] = change;
        else
            if (getTypeStr (pointer[path]) != 'number')
                throw new Error ('cannot apply $inc on a non-numeric value');
            else
                pointer[path] += change;
    },
    '$min':         function $min (pointer, path, change) {
        if (getTypeStr (change) != 'number')
            throw new Error ('cannot $min to a non-numeric value');
        if (!Object.hasOwnProperty.call (pointer, path))
            pointer[path] = change;
        else
            if (getTypeStr (pointer[path]) != 'number')
                throw new Error ('cannot apply $min on a non-numeric value');
            else
                pointer[path] = Math.min (pointer[path], change);
    },
    '$max':         function $max (pointer, path, change) {
        if (getTypeStr (change) != 'number')
            throw new Error ('cannot $max to a non-numeric value');
        if (!Object.hasOwnProperty.call (pointer, path))
            pointer[path] = change;
        else
            if (getTypeStr (pointer[path]) != 'number')
                throw new Error ('cannot apply $max on a non-numeric value');
            else
                pointer[path] = Math.max (pointer[path], change);
    },
    '$mul':         function $mul (pointer, path, change) {
        if (getTypeStr (change) != 'number')
            throw new Error ('cannot $mul by a non-numeric value');
        if (!Object.hasOwnProperty.call (pointer, path))
            pointer[path] = change;
        else
            if (getTypeStr (pointer[path]) != 'number')
                throw new Error ('cannot apply $mul on a non-numeric value');
            else
                pointer[path] *= change;
    },
    '$bit':         function $bit (pointer, path, change) {
        if (getTypeStr (change) != 'object')
            throw new Error ('invalid $bit update');
        if (!Object.hasOwnProperty.call (pointer, path))
            pointer[path] = 0;
        else if (getTypeStr (pointer[path]) != 'number')
            throw new Error ('cannot apply $bit on a non-numeric value');

        for (var bitop in change) {
            var delta = change[bitop];
            if (typeof delta != 'number')
                throw new Error ('cannot $bit by a non-numeric value');
            if (bitop == 'and')
                pointer[path] &= delta;
            else if (bitop == 'or')
                pointer[path] |= delta;
            else if (bitop == 'xor')
                pointer[path] ^= delta;
            else
                throw new Error ('unknown bit operation '+bitop);
        }
    },
    '$unset':       function $unset (pointer, path, change) {
        delete pointer[path];
    },
    '$currentDate': function $currentDate (pointer, path, change) {
        pointer[path] = new Date();
    },
    '$rename':      true, // this op is translated to $set/$unset at an earlier stage
    '$isolated':    true  // this op doesn't do anything
};

var ARR_SORT_PRIORITY = [
    'null', 'number', 'string', 'object', 'array', 'buffer', 'boolean', 'date', 'regexp'
];
var SORT_PRIORITY = {};
for (var i in ARR_SORT_PRIORITY) SORT_PRIORITY[ARR_SORT_PRIORITY[i]] = i;
function getLeafsort (sspec) {
    sspec *= -1;
    function leafsort (able, baker) {
        if (able === baker) return 0;
        var aType = getTypeStr (able);
        var bType = getTypeStr (baker);
        if (aType != bType)
            return sspec * (SORT_PRIORITY[bType] - SORT_PRIORITY[aType]);
        if (aType == 'number')
            return sspec * (baker - able);
        if (aType == 'string')
            if (baker > able)
                return sspec;
            else
                return -1 * sspec;
        if (aType == 'object') {
            var aKeys = Object.keys (able)[0];
            var bKeys = Object.keys (baker)[0];
            for (var i in bKeys) {
                if (aKeys[i] == bKeys[i]) { // recurse
                    var comp = leafsort (able[aKeys[i]], baker[aKeys[i]]);
                    if (comp) return comp;
                } else if (bKeys[i] > aKeys[i])
                    return sspec;
                else
                    return -1 * sspec;
            }
        }
        if (aType == 'array') {
            if (!aType.length)
                if (bType.length) return 1;
                else return 0;
            if (!bType.length)
                if (aType.length) return -1;
                else return 0;
            if (sspec > 0) { // find highest
                var aHighest = able[0];
                var bHighest = baker[0];
                for (var i=1,j=able.length; i<j; i++) // recurse
                    if (sspec * leafsort (aHighest, able[i]) > 0)
                        aHighest = able[i];
                for (var i=1,j=baker.length; i<j; i++) // recurse
                    if (sspec * leafsort (bHighest, able[i]) > 0)
                        bHighest = baker[i];
                // recurse
                return leafsort (aHighest, bHighest);
            } else { // find lowest
                var aLowest = able[0];
                var bLowest = baker[0];
                for (var i=1,j=able.length; i<j; i++) // recurse
                    if (sspec * leafsort (aLowest, able[i]) < 0)
                        aLowest = able[i];
                for (var i=1,j=baker.length; i<j; i++) // recurse
                    if (sspec * leafsort (bLowest, able[i]) < 0)
                        bLowest = baker[i];
                // recurse
                return leafsort (aLowest, bLowest);
            }
        }
        if (aType == 'buffer')
            if (able.length != baker.length)
                return sspec * (baker.length - able.length);
            else {
                for (var i=0,j=able.length; i<j; i++)
                    if (able[i] != baker[i])
                        return sspec * (Number(baker[i]) - Number(able[i]));
                return 0;
            }
        if (aType == 'boolean')
            if (bType) return sspec;
            else return -1 * sspec;
        if (aType == 'date')
            if (baker > able)
                return sspec;
            else
                return -1 * sspec;

        // all other types are considered indistinguishable to sort
        return 0;
    }

    return leafsort;
}

function getDocsort (sspec) {
    var leafsort = getLeafsort (1);
    var specPaths = [];
    var specFullpaths = Object.keys (sspec);
    for (var key in sspec)
        if (key.match (/\$/))
            throw new Error ('invalid sort path '+key);
        else
            specPaths.push (key.split ('.'));

    return function (able, baker) {
        for (var i in specPaths) {
            var path = specPaths[i];
            var aPointer = able;
            var bPointer = baker;
            var direction = sspec[specPaths[i]] > 0 ? 1 : -1;
            for (var j in path) {
                var frag = path[j];
                if (!Object.hasOwnProperty.call (able, frag))
                    if (Object.hasOwnProperty.call (baker, frag))
                        return direction;
                    else continue;
                if (!Object.hasOwnProperty.call (baker, frag))
                    if (Object.hasOwnProperty.call (able, frag))
                        return -1 * direction;
                    else continue;
                aPointer = aPointer[frag];
                bPointer = bPointer[frag];
                var comp = direction * leafsort (able, baker);
                if (comp) return comp;
            }
        }
        return 0;
    };
}

var ARR_OPS = {
    '$addToSet':    function $addToSet (pointer, path, change) {
        if (
            Object.hasOwnProperty.call (change, '$position')
         || Object.hasOwnProperty.call (change, '$sort')
         || Object.hasOwnProperty.call (change, '$slice')
        )
            throw new Error ('Ordering modifiers are not allowed together with $addToSet');

        if (!Object.hasOwnProperty.call (pointer, path)) {
            pointer[path] = [ change ];
            return;
        }
        if (getTypeStr (arr) != 'array')
            throw new Error ('cannot apply $addToSet to non-Array property');

        var arr = pointer[path];
        var changeType = getTypeStr (change);
        if (changeType == 'object')
            if (Object.hasOwnProperty.call (change, '$each')) {

            } else if (moreDollars (change))
                throw new Error ('invalid property key in complex update');
            else {
                // complex leaf insert
                for (var i in arr)
                    if (arr[i] == 'object' && deepMatchWithoutDollars (arr[i], change))
                        return;
                arr.push (change);
            }
        else if (changeType == 'array') {
            // complex leaf insert - Array version
            for (var i in arr)
                if (arr[i] == 'array' && deepMatchWithoutDollars (arr[i], change, true))
                    return;
            arr.push (change);
        } else {
            // single leaf insert
            for (var i in arr)
                if (arr[i] === change)
                    return;
            arr.push (change);
        }
    },
    '$push':        function $push (pointer, path, change) {
        var changeType = getTypeStr (change);
        var arr = pointer[path];
        if (changeType == 'object')
            if (Object.hasOwnProperty.call (change, '$each')) {
                var each = change.$each;
                // apply $each, with or without $position
                var position;
                if (Object.hasOwnProperty.call (change, '$position'))
                    position = change.$position >= arr.length ? undefined : change.$position;
                if (position === undefined)
                    for (var i in each)
                        if (moreDollars (each[i]))
                            throw new Error ('invalid property key in complex update');
                        else arr.push (each[i]);
                else
                    for (var i in each)
                        if (moreDollars (each[i]))
                            throw new Error ('invalid property key in complex update');
                        else arr.splice (position, 0, each[i]);

                // apply $sort
                if (Object.hasOwnProperty.call (change, '$sort')) {
                    var sspec = change.$sort;
                    if (typeof sspec == 'number') {
                        sspec = sspec > 0 ? 1 : -1;
                        // leaf sort
                        arr.sort (getLeafsort (sspec));
                    } else
                        // document sort
                        arr.sort (getDocsort (sspec));
                }

                // apply $slice
                if (Object.hasOwnProperty.call (change, '$slice'))
                    if (change.$slice < 0)
                        arr = arr.slice (change.$slice);
                    else
                        arr = arr.slice (0, change.$slice);
            } else if (!moreDollars (change))
                arr.push (change);
    },
    '$pop':         function $pop (pointer, path, change) {
        var changeType = getTypeStr (change);
        if (changeType != 'number')
            throw new Error ('$pop requires a number');

        if (change > 0)
            arr.pop();
        else if (change < 0)
            arr.shift();
    },
    '$pull':        function $pull (pointer, path, change) {
        var arr = pointer[path];
        var changeType = getTypeStr (change);
        if (changeType == 'object' && moreDollars (change)) {
            // match with query
            for (var i=0,j=arr.length; i<j; i++)
                if (matchRawQuery (arr[i], change)) {
                    arr.splice (i, 1);
                    i--; j--;
                }
        } else {
            // match with leaf
            for (var i=0,j=arr.length; i<j; i++)
                if (matchLeaves (arr[i], change)) {
                    arr.splice (i, 1);
                    i--; j--;
                }
        }

    }
};

var TOP_OPS = {};
for (var op in FIELD_OPS) TOP_OPS[op] = FIELD_OPS[op];
for (var op in ARR_OPS) TOP_OPS[op] = ARR_OPS[op];

var MOD_OPS = {
    '$each':        true,
    '$position':    true,
    '$slice':       true,
    '$sort':        true
};
var STUBBORN_OPS = {
    '$set':         true,
    '$inc':         true,
    '$min':         true,
    '$max':         true,
    '$mul':         true,
    '$currentDate': true,
    '$addToSet':    true,
    '$push':        true,
    '$pushAll':     true
};

function resolveDollar (target, query, path) {
    // scan the target for paths that begin with the supplied path.
    // there can be more than one, but
}

function update (query, target, change) {
    if (!change) {
        change = target;
        target = query;
        query = undefined;
    }

    // handle $rename
    if (Object.hasOwnProperty.call (change, '$rename')) {
        // KEYWORD

    }

    var dollarTarget, dollarTargetStr; // only one key can use the $ operator at a time
    for (var op in change) {
        var job = change[op];

        if (!TOP_OPS.hasOwnProperty (op))
            throw new Error ('unrecognized operator '+op);
        if (op == '$rename' || op == '$isolated') continue;

        var stubborn = STUBBORN_OPS.hasOwnProperty (op); // whether to infill missing props
        var writing = false; // whether CURRENTLY infilling missing props
        for (var path in job) {
            var frags = path.split ('.');
            var pointer = target;
            var pointerType = 'object';

            // iterate all but the last frag
            var ok = true;
            for (var i=0,j=frags.length-1; i<j; i++) {
                if (pointerType != 'object' && pointerType != 'array')
                    throw new Error ('Encountered a leaf in the middle of the path '+path);
                var frag = frags[i];

                // dollar operator handling
                if (frag == '$') {
                    if (pointerType != 'array')
                        throw new Error (
                            'Found a non-Array ('
                          + pointerType
                          + ') at the $ operator in path '
                          + path
                        );
                    if (!i)
                        throw new Error (
                            'The path '+path+' is invalid because it begins with the $ operator.'
                        );
                    var newDollar = frags.slice (0, i);
                    var newDollarStr = newDollar.join ('.');
                    if (dollarTarget !== undefined && newDollarStr != dollarTargetStr)
                        throw new Error (
                            'The $ operator may only be used on one field (at '+path+')'
                        );
                    dollarTarget = newDollar;
                    dollarTargetStr = newDollarStr;
                    frag = resolveDollar (target, query, dollarTarget);
                    if (writing)
                        pointer[frag] = [];
                    else if (!Object.hasOwnProperty (pointer, frag))
                        if (!stubborn) {
                            ok = false;
                            break;
                        } else {
                            writing = true;
                            pointer[frag] = [];
                        }
                    pointer = pointer[frag];
                    pointerType = 'array';
                    continue;
                } else if (frag[0] == '$') // operator in middle of path
                    throw new Error ('invalid path '+path);

                // normal path fragment
                if (writing) {
                    pointer[frag] = {};
                    continue;
                }
                if (Object.hasOwnProperty (pointer, frag)) {
                    pointer = pointer[frag];
                    pointerType = getTypeStr (pointer); // the business end of pointerType logic
                    continue;
                }
                if (!stubborn) {
                    ok = false;
                    break;
                }
                writing = true;
                pointer[frag] = {};
                pointerType = 'object';
            }
            if (!ok) continue;

            // we have navigated to the parent of the last fragment in the path
            if (pointerType != 'object' && pointerType != 'array')
                throw new Error ('Encountered a leaf in the middle of the path '+path);

            var frag = frags[frags.length-1];
            // handle the $ operator
            if (frag == '$') {
                if (pointerType != 'array')
                    throw new Error (
                        'Found a non-Array ('
                      + pointerType
                      + ') at the $ operator in path '
                      + path
                    );

                var newDollar = frags.slice (0, i);
                var newDollarStr = newDollar.join ('.');
                if (dollarTarget !== undefined && newDollarStr != dollarTargetStr)
                    throw new Error (
                        'The $ operator may only be used on one field (at '+path+')'
                    );
                dollarTarget = newDollar;
                dollarTargetStr = newDollarStr;
                frag = resolveDollar (target, query, dollarTarget);
            } else if (frag[0] == '$')
                throw new Error ('invalid path '+path);

            // apply the operator
            TOP_OPS[op] (
                pointer,
                frag,
                job[path]
            );
        }
    }
}

module.exports.update = update;
module.exports.testQuery = matchQuery;

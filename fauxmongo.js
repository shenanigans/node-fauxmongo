
/**     @module fauxmongo
    Applies updates and test queries on local javascript Objects instead of records on a far-away
    MongoDB instance. Works comfortably in both the Node.js and browser environments.
*/

/**     @property/Function getTypeStr
    @development
    @private
    Get a useful type string for various javascript types.
*/
var typeGetter = ({}).toString;
try { Buffer; } catch (err) { Buffer = function(){}; }
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object')
        if (obj instanceof Buffer) return 'buffer';
        else return tstr;
    if (tstr == 'text') return 'textnode';
    if (tstr == 'comment') return 'commentnode';
    if (tstr.slice(0,4) == 'html') return 'element';
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
            if (moreDollars (item)) return true;
            else continue;
        if (type == 'array')
            if (moreDollars (item, true)) return true;
    }
    return false;
}


/**     @property/Function matchLeaves
    @development
    @private
    Compare two MongoDB documents, lists or leaves for deep equality.
@argument able
@argument baker
@returns/Boolean
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


/**     @property/json LOOKUP_BSON_TYPE
    @development
    @private
    Maps BSON type numbers to the same type Strings produced by [getTypeStr](.getTypeStr).
*/
var LOOKUP_BSON_TYPE = {
    1:  'number',
    2:  'string',
    3:  'object',
    4:  'array',
    5:  'buffer',
    6:  'undefined',
    8:  'boolean',
    9:  'date',
    10: 'null',
    11: 'regexp',
    13: 'function',
    16: 'number',
    18: 'number'
};


/**     @property/Function QueryValidator

@argument/Object|Array pointer
    The immediate parent of the node being tested.
@argument/String|Number path
    The **simple** key on the parent document where the value to be validated is stored.
@argument query
    The query clause. Individual operators will expect either a document or a query specifier, but
    never interchangeably.
@returns/Boolean
*/
/**     @property/json QFIELD_OPS
    @development
    @private
    A map of query operators that apply to individual leaves, to their query validator Functions.
@Function $gt
    @super .QueryValidator
    Select Numbers greater than a provided Number.
@Function $gte
    @super .QueryValidator
    Select Numbers greater or equal to a provided Number.
@Function $lt
    @super .QueryValidator
    Select Numbers less than a provided Number.
@Function $lte
    @super .QueryValidator
    Select Numbers less or equal to a provided Number.
@Function $in
    @super .QueryValidator
    Select values [equal to](.matchLeaves) any one element among a list of candidate documents.
@Function $nin
    @super .QueryValidator
    Select values [not equal to](.matchLeaves) any of the elements among a list of candidate
    documents.
@Function $ne
    @super .QueryValidator
    Select a value [not equal to](.matchLeaves) a provided value.
@Function $mod
    @super .QueryValidator
    Select a Number where for the provided `divisor` and `remainder`,
    `candidate % divisor == remainder`.
@Function $regex
    @super .QueryValidator
    Select a String that matches the provided regular expression.
@Function $type
    @super .QueryValidator
    Select any value of the specified [type](.getBSONType).
@Function $where
    @super .QueryValidator
    Submit the candidate value to a validator Function and convert the return value to Boolean.
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
            if (getTypeStr (subquery) == 'regexp') {
                if (!isString) continue;
                else if (val.match (subquery))
                    return true;
            } else if (matchLeaves (subquery, val))
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
            if (getTypeStr (subquery) == 'regexp') {
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
        if (getTypeStr (query) != 'number')
            throw new Error ('$type requires a BSON type integer');
        if (!LOOKUP_BSON_TYPE.hasOwnProperty (query))
            return false;
        return getTypeStr (pointer[path]) == LOOKUP_BSON_TYPE[query];
    }
};

/**     @property/Object QARR_OPS
    @development
    @private
    A map of query operators that apply to individual Arrays, to their query validator Functions.
*/
var QARR_OPS = {
    '$all':         function $all (pointer, path, query) {
        var arr = pointer[path];
        if (getTypeStr (query) != 'array')
            throw new Error ('$all requires an Array of values');
        if (!arr.length) return true;

        var clone = [];
        clone.push.apply (clone, query);
        for (var i in arr)
            for (var j=0,k=clone.length; j<k; j++)
                if (matchLeaves (arr[i], clone[j])) {
                    clone.splice (j, 1);
                    j--; k--;
                    if (!k) return true;
                }
        return false;
    },
    '$elemMatch':   function $elemMatch (pointer, path, query) {
        if (getTypeStr (query) != 'object')
            throw new Error ('$elemMatch requires a query document');
        var arr = pointer[path];
        for (var i in arr)
            if (matchQuery (arr[i], query))
                return true;
        return false;
    },
    '$size':        function $size (pointer, path, query) {

    }
};

/**     @property/Object QUERY_OPS
    @development
    @private
    A map of all query operators to their query validator Functions.
*/
var QUERY_OPS = {};
for (var key in QFIELD_OPS) QUERY_OPS[key] = QFIELD_OPS[key];
for (var key in QARR_OPS) QUERY_OPS[key] = QARR_OPS[key];

/**     @property/Function matchQuery
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

            if (!Object.hasOwnProperty.call (pointer, frag)) {
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

/**     @property/Object FIELD_OPS
    @development
    @private
    A map of update operators that apply to individual leaves, to their update applicator Functions.
*/
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
            pointer[path] = 0;
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

/**     @property/Function getLeafSort
    @development
    @private
    Creates a simple sort function closing on the desired sort polarity. MongoDB documents are
    compared as leaf data, with data type being the highest priority. Some documents may cause
    recursion.
@argument/Number sspec
@returns/Function
*/
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


/**     @property/Function getDocSort
    @development
    @private
    Creates a complex sort function closing on the provided specification document. Documents are
    compared preferentially according to the specification.
@argument/Object sspec
@returns/Function
    A Function suitable for use with [standard sorting](Array#sort).
*/
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
            var direction = sspec[specFullpaths[i]] > 0 ? 1 : -1;
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
            }
            var comp = direction * leafsort (aPointer, bPointer);
            if (comp) return comp;
        }
        return 0;
    };
}

/**     @property/Object ARR_OPS
    @development
    @private
    A map of update operators that apply to Arrays, to their update applicator Functions.
*/
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

        var arr = pointer[path];
            if (getTypeStr (change) == 'object' && Object.hasOwnProperty.call (change, '$each'))
                for (var i in change.$each) {
                    var candidate = change.$each[i];
                    var write = true;
                    for (var j in arr)
                        if (matchLeaves (arr[j], candidate)) {
                            write = false;
                            break;
                        }
                    if (write)
                        arr.push (change.$each[i]);
                }
            else {
                for (var i in arr)
                    if (matchLeaves (arr[i], change))
                        return;
                arr.push (change);
            }
    },
    '$push':        function $push (pointer, path, change) {
        var changeType = getTypeStr (change);
        var arr = pointer[path];
        if (changeType != 'object')
            arr.push (change);
        else if (Object.hasOwnProperty.call (change, '$each')) {
            var each = change.$each;
            // apply $each, with or without $position
            var position;
            if (Object.hasOwnProperty.call (change, '$position'))
                if (change.$position < 0)
                    throw new Error ('$position does not accept negative numbers');
                else
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
                    pointer[path] = arr.slice (change.$slice);
                else
                    pointer[path] = arr.slice (0, change.$slice);
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
        if (changeType == 'object') {
            // match with query
            for (var i=0,j=arr.length; i<j; i++)
                if (matchQuery (arr[i], change)) {
                    arr.splice (i, 1);
                    i--; j--;
                }
        } else
            // match with leaf
            for (var i=0,j=arr.length; i<j; i++)
                if (matchLeaves (arr[i], change)) {
                    arr.splice (i, 1);
                    i--; j--;
                }
    },
    '$pullAll':     function $pullAll (pointer, path, change) {
        var arr = pointer[path];
        if (getTypeStr (change) != 'array')
            throw new Error ('$pullAll requires an Array of values/documents to match');
        for (var i in change)
            for (var k=0, l=arr.length; k<l; k++)
                if (matchLeaves (arr[k], change[i])) {
                    arr.splice (k, 1);
                    k--; l--;
                }
    }
};

/**     @property/Object TOP_OPS
    @development
    @private
    A map of all known update operators to their update applicator Functions.
*/
var TOP_OPS = {};
for (var op in FIELD_OPS) TOP_OPS[op] = FIELD_OPS[op];
for (var op in ARR_OPS) TOP_OPS[op] = ARR_OPS[op];

/**     @property/Object MOD_OPS
    @development
    @private
    A truth map of those update operators which are considered modifiers.
*/
var MOD_OPS = {
    '$each':        true,
    '$position':    true,
    '$slice':       true,
    '$sort':        true
};
/**     @property/Object STUBBORN_OPS
    @development
    @private
    A truth map of every update modifier that infills missing Objects when resolving a deep path.
*/
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
    for (var qpath in query) {
        if (qpath.slice (0, pslen) != pathstr)
            continue;
        subquery = query[qpath];
        var dummyQuery = {};
        dummyQuery[qpath.slice (pslen+1)] = subquery;
        for (var i in pointer)
            if (matchQuery (pointer[i], dummyQuery)) {
                dollar = i;
                break;
            }
    }

    return dollar;
}

/**     @property/Function update

*/
function update (query, target, change) {
    if (!change) {
        change = target;
        target = query;
        query = undefined;
    }

    // $rename
    if (Object.hasOwnProperty.call (change, '$rename'))
        for (var oldPath in change.$rename) {
            // acquire the value assigned to the current path, if able
            // else skip this path
            var pointer = target;
            var notOK;
            var frags = oldPath.split ('.');
            for (var i in frags) {
                var type = getTypeStr (pointer);
                if (type != 'object' && type != 'array')
                    throw new Error ('cannot traverse data to rename path '+oldPath);

                var frag = frags[i];
                if (frag[0] == '$')
                    throw new Error ('cannot rename dynamic path '+oldPath);
                if (!Object.hasOwnProperty.call (pointer, frag)) { // value not found
                    notOK = true;
                    break;
                }
                pointer = pointer[frag];
            }
            if (notOK) continue; // try the next path

            var newPath = change.$rename[oldPath];
            if (!Object.hasOwnProperty.call (change, '$set'))
                change.$set = {};
            // what do you think about the newPath?
            if (Object.hasOwnProperty.call (change.$set, newPath))
                throw new Error ('cannot rename more than one value to the same path '+newPath);
            change.$set[newPath] = pointer;
            if (!Object.hasOwnProperty.call (change, '$unset'))
                change.$unset = {};
            change.$unset[oldPath] = true;
        }

    var dollarTarget, dollarTargetStr; // only one key can use the $ operator at a time
    for (var op in change) {
        var job = change[op];

        if (!TOP_OPS.hasOwnProperty (op))
            throw new Error ('unrecognized operator '+op);
        if (op == '$rename' || op == '$isolated') continue;

        var stubborn = STUBBORN_OPS.hasOwnProperty (op); // whether to infill missing props
        for (var path in job) {
            var writing = false; // whether CURRENTLY infilling missing props
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
                    if (writing) { // if the key doesn't exist, the positional operator is useless
                        ok = false;
                        break;
                    }
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
                    frag = resolveDollar (target, query, dollarTarget, dollarTargetStr);
                    if (frag < 0) continue;

                    pointer = pointer[frag];
                    pointerType = 'array';
                    continue;
                } else if (frag[0] == '$') // operator in middle of path
                    throw new Error ('invalid path '+path);

                // normal path fragment
                if (writing) {
                    pointer = pointer[frag] = {};
                    continue;
                }
                if (Object.hasOwnProperty.call (pointer, frag)) {
                    pointer = pointer[frag];
                    pointerType = getTypeStr (pointer); // the business end of pointerType logic
                    continue;
                }
                if (!stubborn) {
                    ok = false;
                    break;
                }
                writing = true;
                pointer = pointer[frag] = {};
                pointerType = 'object';
            }
            if (!ok) continue;

            // we have navigated to the parent of the last fragment in the path
            if (pointerType != 'object' && pointerType != 'array')
                throw new Error ('Encountered a leaf in the middle of the path '+path);

            var frag = frags[frags.length-1];
            // handle the $ operator
            if (frag == '$') {
                if (writing) // if the key is missing, the positional operator is useless
                    continue;
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
                frag = resolveDollar (target, query, dollarTarget, dollarTargetStr);
                if (frag < 0) continue;
            } else if (frag[0] == '$')
                throw new Error ('invalid path '+path);

            // array operations require pointer[frag] to be an array
            if (ARR_OPS.hasOwnProperty (op))
                if (pointer[frag] === undefined)
                    if (stubborn)
                        pointer[frag] = [];
                    else continue;
                else if (getTypeStr (pointer[frag]) != 'array')
                    throw new Error ('cannot apply '+op+' to non-array value');

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
module.exports.matchQuery = matchQuery;

/**     @enum BSON_TYPES
    For convenience, MongoDB's data type constants are provided.
@named DOUBLE
@named STRING
@named OBJECT
@named ARRAY
@named BUFFER
@named UNDEFINED
@named OBJECT_ID
@named BOOLEAN
@named DATE
@named NULL
@named REGEXP
@named FUNCTION
@named INTEGER
@named LONG
*/
var BSON_TYPES = {};
BSON_TYPES['DOUBLE']        = 1;
BSON_TYPES['STRING']        = 2;
BSON_TYPES['OBJECT']        = 3;
BSON_TYPES['ARRAY']         = 4;
BSON_TYPES['BUFFER']        = 5;
BSON_TYPES['UNDEFINED']     = 6;
BSON_TYPES['OBJECT_ID']     = 7;
BSON_TYPES['BOOLEAN']       = 8;
BSON_TYPES['DATE']          = 9;
BSON_TYPES['NULL']          = 10;
BSON_TYPES['REGEXP']        = 11;
BSON_TYPES['FUNCTION']      = 13;
BSON_TYPES['INTEGER']       = 16;
BSON_TYPES['LONG']          = 18;
module.exports.BSON_TYPES   = BSON_TYPES;

/**     @property/Function getBSONType

@argument/Object obj
@argument/Boolean simpleNums
    @optional
    In simpleNums mode, a [Number]() is always of [DOUBLE](.DOUBLE) type.
@returns/Number
    Returns one of the following values from [BSON_TYPES]():
     * 0 - unknown type
     * 1 - double
     * 2 - string
     * 3 - object
     * 4 - array
     * 5 - buffer
     * 6 - undefined
     * 7 - ObjectID
     * 8 - boolean
     * 9 - date
     * 10 - null
     * 11 - regexp
     * 13 - function
     * 16 - integer
     * 18 - long
*/
module.exports.getBSONType = function (obj, simpleNums) {
    var type = getTypeStr (obj);
    if (type == 'number') {
        if (simpleNums) return 1;
        if (Math.round (obj) == obj)
            return 16;
        return 1;
    }
    if (!BSON_TYPES.hasOwnProperty (type))
        return 0;
    return BSON_TYPES[type];
};

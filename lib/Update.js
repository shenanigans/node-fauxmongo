
/**     @property/Function fauxmongo.update
    @root
    Apply a MongoDB update operation in place.
@argument/Object query
    @optional
    If the update uses the positional operator, provide a query to define it.
@argument/Object target
    The document to update. This document will be modified.
@argument/Object change
    The update specification to apply.
*/

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

        if (!operators.ops.hasOwnProperty (op))
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
            if (operators.arrOps.hasOwnProperty (op))
                if (pointer[frag] === undefined)
                    if (stubborn)
                        pointer[frag] = [];
                    else continue;
                else if (getTypeStr (pointer[frag]) != 'array')
                    throw new Error ('cannot apply '+op+' to non-array value');

            // apply the operator
            operators.ops[op] (
                pointer,
                frag,
                job[path]
            );
        }
    }
}

module.exports = update;
var operators = require ('./UpdateOperators');
var getTypeStr = require ('./GetTypeStr');
var resolveDollar = require ('./ResolveDollar');

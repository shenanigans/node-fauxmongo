
var getTypeStr = require ('./GetTypeStr');
var Sorting = require ('./Sorting');
var moreDollars = require ('./MoreDollars');
var matchLeaves = require ('./MatchLeaves');
var matchQuery = require ('./MatchQuery');


var fieldOps = {
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


var arrOps = {
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
                    arr.sort (Sorting.getLeafsort (sspec));
                } else
                    // document sort
                    arr.sort (Sorting.getDocsort (sspec));
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


var ops = {};
for (var op in fieldOps) ops[op] = fieldOps[op];
for (var op in arrOps) ops[op] = arrOps[op];

module.exports.ops = ops;
module.exports.fieldOps = fieldOps;
module.exports.arrOps = arrOps;

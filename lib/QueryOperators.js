
var getTypeStr = require ('./GetTypeStr');
var matchLeaves = require ('./MatchLeaves');
var matchQuery = require ('./MatchQuery');


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


var fieldOps = {
    '$not':         function $not (val, query) {
        if (getTypeStr (val) != 'object')
            throw new Error ('$not requires a query document');
        if (matchQuery (val, query))
            return false;
        return true;
    },
    '$gt':          function $gt (val, query) {
        if (typeof val != 'number' || typeof query != 'number' || val <= query)
            return false;
        return true;
    },
    '$gte':         function $gte (val, query) {
        if (typeof val != 'number' || typeof query != 'number' || val < query)
            return false;
        return true;
    },
    '$in':          function $in (val, query) {
        if (getTypeStr (query) != 'array')
            throw new Error ('$in requires an Array');

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
    '$lt':          function $lt (val, query) {
        if (typeof val != 'number' || typeof query != 'number' || val >= query)
            return false;
        return true;
    },
    '$lte':         function $lte (val, query) {
        if (typeof val != 'number' || typeof query != 'number' || val > query)
            return false;
        return true;
    },
    '$ne':          function $ne (val, query) {
        if (matchLeaves (val, query))
            return false;
        return true;
    },
    '$nin':         function $nin (val, query) {
        if (getTypeStr (query) != 'array')
            throw new Error ('$nin requires an Array');

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
    '$mod':         function $mod (val, query) {
        if (getTypeStr (query) != 'array' || query.length != 2)
            throw new Error ('$in requires an Array of [ divisor, remainder ]');

        if (typeof val != 'number') return false;

        if (val % query[0] == query[1])
            return true;
        return false;
    },
    '$regex':       function $regex (val, query) {
        if (getTypeStr (query) != 'regexp')
            throw new Error ('$regex requires a RegExp');

        if (typeof val != 'string')
            return false;
        return val.match (query) ? true : false;
    },
    '$type':        function $type (val, query) {
        if (getTypeStr (query) != 'number')
            throw new Error ('$type requires a BSON type integer');
        if (!LOOKUP_BSON_TYPE.hasOwnProperty (query))
            return false;
        return getTypeStr (val) == LOOKUP_BSON_TYPE[query];
    }
};


var arrOps = {
    '$all':         function $all (arr, query) {
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
    '$elemMatch':   function $elemMatch (arr, query) {
        if (getTypeStr (query) != 'object')
            throw new Error ('$elemMatch requires a query document');
        for (var i in arr)
            if (matchQuery (arr[i], query))
                return true;
        return false;
    },
    '$size':        function $size (arr, query) {
        if (getTypeStr (query) != 'number')
            throw new Error ('$size requires an integer');
        if (arr.length == query)
            return true;
        return false;
    }
};


var ops = {};
for (var key in fieldOps) ops[key] = fieldOps[key];
for (var key in arrOps) ops[key] = arrOps[key];

module.exports.ops = ops;
module.exports.fieldOps = fieldOps;
module.exports.arrOps = arrOps;

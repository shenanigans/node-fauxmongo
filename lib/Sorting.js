
var getTypeStr = require ('./GetTypeStr');

var ARR_SORT_PRIORITY = [
    'null', 'number', 'string', 'object', 'array', 'buffer', 'boolean', 'date', 'regexp'
];
var SORT_PRIORITY = {};
for (var i in ARR_SORT_PRIORITY) SORT_PRIORITY[ARR_SORT_PRIORITY[i]] = i;

/**     @module fauxmongo.Sorting
    Generate sorter Functions for ordering documents and leaves.
*/

/**     @property/Function getLeafSort
    @development
    @private
    Creates a simple sort function closing on the desired sort polarity. MongoDB documents are
    compared as leaf data, with data type being the highest priority.
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
            return Math.max (-1, Math.min (1,
                sspec * (SORT_PRIORITY[bType] - SORT_PRIORITY[aType])
            ));
        if (aType == 'number')
            return Math.max (-1, Math.min (1, sspec * (baker - able)));
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
                return Math.max (-1, Math.min (1, sspec * (baker.length - able.length)));
            else {
                for (var i=0,j=able.length; i<j; i++)
                    if (able[i] != baker[i])
                        return Math.max (-1, Math.min (1,
                            sspec * (Number(baker[i]) - Number(able[i]))
                        ));
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
    compared according to the specification.
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


module.exports.getLeafsort = getLeafsort;
module.exports.getDocsort = getDocsort;

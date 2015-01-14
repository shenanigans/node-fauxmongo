
var getTypeStr = require ('./GetTypeStr');

/**     @module/Function fauxmongo.matchQuery.matchLeaves
    @development
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
        var keys = Object.keys (able);
        if (keys.length != Object.keys (baker).length) return false;
        for (var i in keys) {
            var key = keys[i];
            if (!Object.hasOwnProperty.call (baker, key) || !matchLeaves (able[key], baker[key]))
                return false;
        }
        return true;
    } else return false;
}

module.exports = matchLeaves;

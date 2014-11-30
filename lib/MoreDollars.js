
var getTypeStr = require ('./GetTypeStr');

/**     @module/Function moreDollars
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

module.exports = moreDollars;

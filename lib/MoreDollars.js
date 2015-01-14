
var getTypeStr = require ('./GetTypeStr');

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

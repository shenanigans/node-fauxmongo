
/**     @module/class fauxmongo/lib/FauxmongoError
    @super Error

@String #code
@String #message
*/

var util = require ('util');

function FauxmongoError (code, message, info) {
    Error.call (this);
    this.code = code;
    this.message = message;
    if (info) for (var key in info) this[key] = info[key];
}
util.inherits (FauxmongoError, Error);

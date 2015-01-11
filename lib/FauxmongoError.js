
/**     @module/class fauxmongo/lib/FauxmongoError
    @super Error

@String #code
     * **SUPPORT** the update, query or pipeline specification requests
     * **INVALID** the update, query or pipeline specification was invalid
     * **FORMAT** a record in the input set could not be processed by the aggregation pipeline
        because a field was either missing or incorrectly typed.
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

module.exports = FauxmongoError;

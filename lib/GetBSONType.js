
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

/**     @property/Function fauxmongo.getBSONType
    @root
    Return a numeric BSON type for a javascript object.
@argument/Object subject
    The object to test for type.
@argument/Boolean simpleNums
    @optional
    In simpleNums mode, a Number is always of `DOUBLE` type. Otherwise it will be evaluated as
    potentially an integer.
@returns/Number
    Returns one of the following values:
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
function getBSONType (obj, simpleNums) {
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
}

module.exports = getBSONType;

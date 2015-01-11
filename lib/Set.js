
/**     @module/class fauxmongo.Set

@argument/Array values
*/

var matchLeaves = require ('./MatchQuery').matchLeaves;
var getTypeStr = require ('./getTypeStr');

function Set (values) {
    this.strings = {};
    this.nums = {};
    this.others = [];

    if (values) for (var i in values) {
        var val = values[i];
        var type = getTypeStr (val);
        if (type == 'string')
            this.strings[val] = true;
        else if (type == 'number')
            this.nums[val] = true;
        else {
            var found = false;
            for (var j in this.others)
                if (matchLeaves (val, this.others[j])) {
                    found = true;
                    break;
                }
            if (!found)
                this.others.push (val);
        }
    }
}


/**     @member/Function union

@argument/.Set other
*/
Set.prototype.union = function (other) {
    for (var key in other.strings)
        this.strings[key] = true;
    for (var key in other.nums)
        this.nums[key] = true;
    for (var i in other.others) {
        var found = false;
        for (var j in this.others)
            if (matchLeaves (other.others[i], this.others[j])) {
                found = true;
                break;
            }
        if (!found)
            this.others.push (other.others[i]);
    }
};


/**     @member/Function difference

@argument/.Set other
*/
Set.prototype.difference = function (other) {
    for (var key in other.strings)
        delete this.strings[key];
    for (var key in other.nums)
        delete this.nums[key];
    for (var oi in other.others)
        for (var i=0,j=this.others.length; i<j; i++)
            if (matchLeaves (this.others[i], other.others[oi])) {
                this.others.splice (i, 1);
                i--; j--;
                break;
            }
};


/**     @member/Function intersect

@argument/.Set other
@returns/.Set newSet
*/
Set.prototype.intersect = function (other) {
    var newSet = new Set ([]);
    for (var key in other.strings)
        if (Object.hasOwnProperty.call (this.strings, key))
            newSet.strings[key] = true;
    for (var key in other.nums)
        if (Object.hasOwnProperty.call (this.nums, key))
            newSet.nums[key] = true;
    for (var oi in other.others)
        for (var i=0,j=this.others.length; i<j; i++)
            if (matchLeaves (this.others[i], other.others[oi])) {
                newSet.others.push (this.others[i]);
                break;
            }

    return newSet;
};


/**     @member/Function export

@returns/Array
    An Array of unique elements in this Set.
*/
Set.prototype.export = function(){
    var vals = Object.keys (this.strings);
    vals.push.apply (vals, Object.keys (this.nums).map (Number));
    vals.push.apply (vals, this.others);
    return vals;
};


/**     @member/Function equals

@argument/.Set other
@returns/Boolean
*/
Set.prototype.equals = function (other) {
    if (this.others.length != other.others.length)
        return false;

    var strings = Object.keys (this.strings);
    var nums = Object.keys (this.nums);
    var otherStrings = Object.keys (other.strings);
    var otherNums = Object.keys (other.nums);

    if (strings.length != otherStrings.length || nums.length != otherNums.length)
        return false;

    for (var i in strings)
        if (!Object.hasOwnProperty.call (other.strings, strings[i]))
            return false;

    for (var i in nums)
        if (!Object.hasOwnProperty.call (other.nums, nums[i]))
            return false;

    for (var i in this.others) {
        var found = false;
        for (var j in other.others)
            if (matchLeaves (other.others[j], this.others[i])) {
                found = true;
                break;
            }
        if (!found)
            return false;
    }

    return true;
};


/**     @member/Function contains

@argument/.Set other
@returns/Boolean
*/
Set.prototype.contains = function (other) {
    for (var key in other.strings)
        if (!Object.hasOwnProperty.call (this.strings, key))
            return false;

    for (var key in other.nums)
        if (!Object.hasOwnProperty.call (this.nums, key))
            return false;

    for (var i in other.others) {
        var found = false;
        for (var j in this.others)
            if (matchLeaves (this.others[j], other.others[i])) {
                found = true;
                break;
            }
        if (!found) return false;
    }

    return true;
};


/**     @member/Function add

@argument value
@returns/Boolean `true` if the item was added, `false` if it was already there.
*/
Set.prototype.add = function (val) {
    var type = getTypeStr (val);
    if (type == 'string' && !Object.hasOwnProperty.call (this.nums, val))
        this.strings[val] = true;
    else if (type == 'number' && !Object.hasOwnProperty.call (this.nums, String (val)))
        this.nums[val] = true;
    else {
        var found = false;
        for (var j in this.others)
            if (matchLeaves (val, this.others[j])) {
                found = true;
                break;
            }
        if (!found) {
            this.others.push (val);
            return true;
        }
    }
};

module.exports = Set;

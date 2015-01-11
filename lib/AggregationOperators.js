
/**     @module AggregationExpressions

*/
var getTypeStr = require ('./GetTypeStr');
var getBSONType = require ('./getBSONType');
var matchLeaves = require ('./MatchQuery').matchLeaves;
var Sorting = require ('./Sorting');
var leafSorter = Sorting.getLeafsort (1);
var Set = require ('./Set');
var FauxmongoError = require ('./FauxmongoError');

function evaluate (expression, context) {
    var type = getTypeStr (expression);
    if (type == 'string') {
        if (expression[0] == '$')
            if (expression[1] == '$') {
                // variable
                var varname = expression.slice (2);
                if (Object.hasOwnProperty.call (context, varname))
                    return context[varname];
                throw new FauxmongoError ('INVALID', 'variable '+expression+' not found');
            } else {
                // path
                var pointer = context.CURRENT;
                var frags = expression.slice(1).split ('.');
                for (var i in frags) {
                    var frag = frags[i];
                    if (!Object.hasOwnProperty.call (pointer, frag))
                        return undefined;
                    pointer = pointer[frag];
                }
                return pointer;
            }
        return expression;
    }

    if (type == 'object') {
        var key = Object.keys (expression)[0];
        if (key[0] != '$') {
            var newDoc = {};
            for (var key in expression)
                newDoc[key] = evaluate (expression[key], context);
            return newDoc;
        }

        if (key == '$literal')
            return expression.$literal;

        if (key == '$let') {
            var backup = {};
            var spec = expression.$let;

            // prime context
            for (var tempVar in spec.vars) {
                if (Object.hasOwnProperty.call (context, tempVar))
                    backup[tempVar] = context[tempVar];
                context[tempVar] = evaluate (spec.vars[tempVar], context);
            }

            // evaluate with primed context
            var retval = evaluate (spec.in, context);

            // restore context
            for (var tempVar in spec.vars) {
                if (Object.hasOwnProperty.call (backup, tempVar))
                    context[tempVar] = backup[tempVar];
                else
                    delete context[tempVar];
            }

            return retval;
        }

        if (key == '$map') {
            var spec = expression.$map;
            var backup = Object.hasOwnProperty.call (context, spec.as) ?
                context[spec.as]
              : undefined
              ;

            var docs = evaluate (spec.input, context);
            if (!(docs instanceof Array))
                throw new Error ('$map requires an Array input');

            var results = [];
            for (var i in docs) {
                context[spec.as] = docs[i];
                results.push (evaluate (spec.in, context));
            }

            if (backup !== undefined)
                context[spec.as] = backup;
            else
                delete context[spec.as];
            return results;
        }

        if (!Object.hasOwnProperty.call (AggregationOperators, key))
            throw new Error ('unknown aggregation operator '+key);
        return AggregationOperators[key] (expression[key], context);
    }

    return expression;
}


/**     @local/Function AggregationOperator
    @development
    @private
@argument/String|Object expression
@argument/Object context
@returns
    The modified value.
*/
/**     @local/Object[%AggregationOperator] AggregationOperators

*/
var AggregationOperators = {
    '$and':             function (expression, context) {
        for (var i in expression)
            if (!evaluate (expression[i], context))
                return false;
        return true;
    },
    '$or':              function (expression, context) {
        for (var i in expression)
            if (!evaluate (expression[i], context))
                return true;
        return false;
    },
    '$not':             function (expression, context) {
        return ! Boolean (evaluate (expression[0], context));
    },
    '$allElementsTrue': function (expression, context) {
        expression = expression[0];
        var set = evaluate (expression, context);
        if (!(set instanceof Array))
            throw new Error ('$allElementsTrue requires an Array');
        for (var i in set)
            if (!set[i])
                return false;
        return true;
    },
    '$anyElementTrue':  function (expression, context) {
        expression = expression[0];
        var set = evaluate (expression, context);
        if (!(set instanceof Array))
            throw new Error ('$anyElementTrue requires an Array');
        for (var i in set)
            if (set[i])
                return true;
        return false;
    },
    '$setDifference':   function (expression, context) {
        var able = new Set (evaluate (expression[0], context));
        var baker = new Set (evaluate (expression[1], context));
        able.difference (baker);
        return able.export();
    },
    '$setEquals':       function (expression, context) {
        var sets = [];
        for (var i in expression) {
            var val = evaluate (expression[i], context);
            if (!(val instanceof Array))
                throw new Error ('$setEquals only accepts Arrays');
            sets.push (new Set (val));
        }

        if (sets.length < 2)
            throw new Error ('$setEquals requires at least 2 sets');

        var first = sets[1];
        for (var i=1,j=sets.length; i<j; i++)
            if (!first.equals (sets[i]))
                return false;

        return true;
    },
    '$setIntersection': function (expression, context) {
        var sets = [];
        for (var i in expression) {
            var val = evaluate (expression[i], context);
            if (!(val instanceof Array))
                throw new Error ('$setIntersection only accepts Arrays');
            sets.push (new Set (val));
        }

        if (sets.length < 2)
            throw new Error ('$setIntersection requires at least 2 sets');

        var walker = sets[0];
        for (var i=1,j=sets.length; i<j; i++)
            walker = walker.intersect (sets[i]);

        return walker.export();
    },
    '$setIsSubset':     function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        if (!(able instanceof Array) || !(baker instanceof Array))
            throw new FauxmongoError ('FORMAT', '$setIsSubset only accepts Arrays');
        able = new Set (able);
        baker = new Set (baker);
        return baker.contains (able);
    },
    '$setUnion':        function (expression, context) {
        var sets = [];
        for (var i in expression)
            sets.push (new Set (evaluate (expression[i], context)));

        if (sets.length < 2)
            throw new Error ('$setIntersection requires at least 2 sets');

        var first = sets[0];
        for (var i=1,j=sets.length; i<j; i++)
            first.union (sets[i]);

        return first.export();
    },
    '$cmp':             function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return leafSorter (able, baker);
    },
    '$eq':              function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return matchLeaves (able, baker);
    },
    '$gt':              function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return leafSorter (able, baker) > 0 ? true : false;
    },
    '$gte':             function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return leafSorter (able, baker) >= 0 ? true : false;
    },
    '$lt':              function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return leafSorter (able, baker) < 0 ? true : false;
    },
    '$lte':             function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return leafSorter (able, baker) <= 0 ? true : false;
    },
    '$ne':              function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        return !matchLeaves (able, baker);
    },
    '$add':             function (expression, context) {
        var vals = [];
        var datestamp = false;
        for (var i in expression) {
            var val = evaluate (expression[i], context);
            var type = typeof val;
            if (type == 'date')
                if (datestamp)
                    throw new Error ('$add accepts at most 1 Date');
                else datestamp = val;
            else if (type != 'number')
                throw new Error ('$add only accepts Numbers and Dates');
            else
                vals.push (val);
        }

        if (datestamp) {
            var tms = datestamp.getTime();
            for (var i in vals)
                tms += vals[i];
            datestamp.setTime (tms);
            return datestamp;
        }

        var total = 0;
        for (var i in vals)
            total += vals[i];
        return total;
    },
    '$divide':          function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        if (typeof able != 'number' || typeof baker != 'number')
            throw new Error ('$divide only accepts Numbers');

        return able / baker;
    },
    '$mod':             function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        if (typeof able != 'number' || typeof baker != 'number')
            throw new Error ('$divide only accepts Numbers');

        return able % baker;
    },
    '$multiply':        function (expression, context) {
        var vals = [];
        for (var i in expression) {
            var val = evaluate (expression[i], context);
            if (typeof val != 'number')
                throw new Error ('$multiply only accepts Numbers');
            vals.push (val);
        }

        var accumulator = 1;
        for (var i in vals)
            accumulator *= vals[i];
        return accumulator;
    },
    '$subtract':        function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        if (typeof able != 'number' || typeof baker != 'number')
            throw new Error ('$divide only accepts Numbers');

        return able - baker;
    },
    '$concat':          function (expression, context) {
        var vals = [];
        for (var i in expression) {
            var val = evaluate (expression[i], context);
            if (typeof val != 'string')
                if (val === null || val === undefined)
                    return null;
                else
                    throw new Error ('$multiply only accepts Numbers');
            vals.push (val);
        }

        if (vals.length < 2)
            throw new Error ('$concat requires at least 2 arguments');

        return String.prototype.concat.apply ('', vals);
    },
    '$strcasecmp':      function (expression, context) {
        var able = evaluate (expression[0], context);
        var baker = evaluate (expression[1], context);
        if (typeof able != 'string' || typeof baker != 'string')
            throw new Error ('$strcasecmp only accepts Strings');

        able = able.toUpperCase();
        baker = baker.toUpperCase();
        if (able == baker)
            return 0;
        if (able < baker)
            return -1;
        return 1;
    },
    '$substr':          function (expression, context) {
        var str = evaluate (expression[0], context);
        var start = evaluate (expression[1], context);
        var length = evaluate (expression[2], context);

        if (typeof str != 'string' || typeof start != 'number' || typeof length != 'number')
            throw new Error ('invalid arguments to $substr');

        if (start < 0)
            return '';
        if (length < 0)
            return str.slice (start);
        return str.slice (start, start + length);
    },
    '$toLower':         function (expression, context) {
        var str = evaluate (expression, context);
        if (str === null)
            return '';
        if (typeof str != 'string')
            throw new Error ('$toLower only accepts Strings');
        return str.toLowerCase();
    },
    '$toUpper':         function (expression, context) {
        var str = evaluate (expression, context);
        if (str === null)
            return '';
        if (typeof str != 'string')
            throw new Error ('$toUpper only accepts Strings');
        return str.toUpperCase();
    },
    '$meta':            function (expression, context) {
        throw new Error ('$meta not supported');
    },
    '$size':            function (expression, context) {
        var arr = evaluate (expression, context);
        if (!(arr instanceof Array))
            throw new Error ('$size only accepts Arrays');
        return arr.length;
    },
    '$dayOfMonth':      function (expression, context) {
        if (!(expression instanceof Date))
            throw new Error ('$dayOfMonth only accepts Dates');
        return expression.getDate();
    },
    '$dayOfWeek':       function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$dayOfWeek only accepts Dates');
        return (expression.getDay() % 7) + 1;
    },
    '$dayOfYear':       function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$dayOfYear only accepts Dates');

        // all the oldest javascript apis are puketastic
        var start = new Date(expression.getFullYear(), 0, 0);
        var diff = expression - start;
        return Math.floor (diff / ( 1000 * 60 * 60 * 24 ));
    },
    '$hour':            function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$hour only accepts Dates');
        return expression.getHours();
    },
    '$millisecond':     function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$millisecond only accepts Dates');
        return expression.getMilliseconds();
    },
    '$minute':          function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$minute only accepts Dates');
        return expression.getMinutes();
    },
    '$month':           function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$month only accepts Dates');
        return expression.getMonth() + 1;
    },
    '$second':          function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$second only accepts Dates');
        return expression.getSeconds();
    },
    '$week':            function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$week only accepts Dates');

        // create a target date set to Sunday of the same week as the expression
        var target = new Date (expression.getTime());
        var days = (expression.getDay() + 6) % 7;
        target.setDate (target.getDate() - days - 1);
        // store the time of the week's Sunday
        var firstSunday = target.getTime();

        // switch to January 1st and advance to Sunday
        target.setMonth (0, 1);
        days = target.getDay();
        if (days != 7)
            target.setMonth (0, 7 - days);

        return 1 + Math.ceil ((target.getTime() - firstSunday) / (1000 * 60 * 60 * 24 * 7));
    },
    '$year':            function (expression, context) {
        expression = evaluate (expression, context);
        if (!(expression instanceof Date))
            throw new Error ('$year only accepts Dates');
        return expression.getFullYear();
    },
    '$cond':            function (expression, context) {
        var ifx, thenx, elsex;
        if (expression instanceof Array) {
            ifx = expression[0];
            thenx = expression[1];
            elsex = expression[2];
        } else {
            if (typeof expression != 'object')
                throw new Error ('$cond requires either an Object or Array of arguments');
            ifx = expression.if;
            thenx = expression.then;
            elsex = expression.else;
        }

        if (evaluate (ifx, context) === true)
            return evaluate (thenx, context);
        return evaluate (elsex, context);
    },
    '$ifNull':          function (expression, context) {
        var val = evaluate (expression[0], context);
        if (val === null)
            return evaluate (expression[1], context);
        return val;
    }
};

/**     @local/Function AggregationAccumulator
    @development
    @private
@argument expression
@argument context
@argument value
@argument reduction
@argument/String|Object expression
@returns
    The modified value.
*/
/**     @local/Object[%AggregationOperator] AggregationAccumulators

*/
var AggregationAccumulators = {
    '$addToSet':    function (expression, docs) {
        var set = new Set();
        for (var i in docs)
            set.add (evaluate (expression, { CURRENT:docs[i] }));
        return set.export();
    },
    '$avg':         function (expression, docs) {
        var count = 0;
        var total = 0;
        for (var i in docs) {
            var val = evaluate (expression, { CURRENT:docs[i] });
            if (typeof val != 'number')
                throw new FauxmongoError ('FORMAT', '$sum only accepts numbers');
            total += val;
            count++;
        }
        return total / count;
    },
    '$first':       function (expression, docs) {
        return evaluate (expression, { CURRENT:docs[0] });
    },
    '$last':        function (expression, docs) {
        return evaluate (expression, { CURRENT:docs[docs.length-1] });
    },
    '$max':         function (expression, docs) {
        var highest = evaluate (expression, { CURRENT:docs[0] });
        for (var i=1,j=docs.length; i<j; i++) {
            var val = evaluate (expression, { CURRENT:docs[i] });
            if (leafSorter (val, highest) > 0)
                highest = val;
        }
        return highest;
    },
    '$min':         function (expression, docs) {
        var lowest = evaluate (expression, { CURRENT:docs[0] });
        for (var i=1,j=docs.length; i<j; i++) {
            var val = evaluate (expression, { CURRENT:docs[i] });
            if (leafSorter (val, lowest) < 0)
                lowest = val;
        }
        return lowest;
    },
    '$push':        function (expression, docs) {
        var output = [];
        for (var i in docs)
            output.push (evaluate (expression, { CURRENT:docs[i] }));
        return output;
    },
    '$sum':         function (expression, docs) {
        var total = 0;
        for (var i in docs) {
            var val = evaluate (expression, { CURRENT:docs[i] });
            if (typeof val != 'number')
                throw new FauxmongoError ('FORMAT', '$sum only accepts numbers');
            total += val;
        }
        return total;
    }
};

module.exports.evaluate = evaluate;
module.exports.accumulators = AggregationAccumulators;

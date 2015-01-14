
var StageOperators = require ('./AggregationStages');
var evaluate = require ('./AggregationOperators').evaluate;
var getTypeStr = require ('./GetTypeStr');
var FauxmongoError = require ('./FauxmongoError');

/**     @module/Function fauxmongo.aggregate
    Locally apply a MongoDB aggregation pipeline. Does not affect the input documents. Optionally
    returns the results of each individual stage as well as the final result.
@argument/Array[Object] docs
    An Array of documents to process.
@argument/Array[Object] pipeline
    An Array of stage operator specifications used to select/modify the source documents.
@argument/Boolean keepStages
    @optional
    If true, the return value is an Array containing each Array of results produced by each stage.
    Otherwise the return value is the final result Array.
@returns/Array|Array[Array]
    Either the final result set or an Array containing the result set of each stage.
*/

function aggregate (docs, pipeline, keepStages) {
    var stages;
    if (keepStages)
        stages = [];

    for (var i in pipeline) {
        var stage = pipeline[i];
        var operator;
        try {
            operator = Object.keys (stage)[0];
        } catch (err) {
            // ignore empty stages
            continue;
        }
        if (operator == '$out') {
            if (i != pipeline.length - 1)
                throw new FauxmongoError (
                    'INVALID',
                    'found an $out stage that was not the final stage'
                );
            break;
        }

        var expression = stage[operator];

        if (!Object.hasOwnProperty.call (StageOperators, operator))
            throw new FauxmongoError ('INVALID', 'unknown operator', { operator:operator });
        docs = StageOperators[operator] (docs, expression);
        if (keepStages)
            stages.push (docs);
    }

    if (keepStages)
        return stages;
    return docs;
}

module.exports = aggregate;
aggregate.evaluateExpression = evaluate;

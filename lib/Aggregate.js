
var StageOperators = require ('./AggregationStages');
var evaluate = require ('./AggregationOperators').evaluate;
var getTypeStr = require ('./GetTypeStr');
var FauxmongoError = require ('./FauxmongoError');

function aggregate (docs, pipeline, keepStages) {
    var stages;
    if (keepStages)
        stages = [ docs ];

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

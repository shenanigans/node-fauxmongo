
/**     @property/Function AggregationStage
    @development
    @private
@argument/Array docs
@argument/String|Object expression
*/

var AggregationOperators    = require ('./AggregationOperators');
var matchQuery              = require ('./MatchQuery');
var project                 = require ('./Project');
var Sorting                 = require ('./Sorting');
var getTypeStr              = require ('./GetTypeStr');
var FauxmongoError          = require ('./FauxmongoError');

function clone (thing) {
    var newThing = {};
    for (var key in thing) {
        var subthing = thing[key];
        if (typeof subthing == 'object')
            if (subthing instanceof Array)
                newThing[key] = cloneArr (subthing);
            else
                newThing[key] = clone (subthing);
        else
            newThing[key] = thing[key];
    }
    return newThing;
}

function cloneArr (thingArr) {
    var newThing = [];
    for (var i in thingArr) {
        var subthing = thingArr[i];
        if (typeof subthing == 'object')
            if (thingArr instanceof Array)
                newThing[i] = clone (subthing);
            else
                newThing[i] = cloneArr (subthing);
        else
            newThing[i] = thingArr[i];
    }
    return newThing;
}

var AggregationStages = {
    '$geoNear':     function (docs, expression) {
        throw new FauxmongoError ('SUPPORT', '$geoNear is not supported');
    },
    '$group':       function (docs, expression) {
        var strings = {};
        var nums = {};
        var others = [];
        var otherDocs = [];

        // establish the groups
        for (var i in docs) {
            var doc = docs[i];
            var context = { CURRENT:doc };
            var id = AggregationOperators.evaluate (expression._id, context);
            var idType = getTypeStr (id);

            if (idType == 'string')
                if (Object.hasOwnProperty.call (strings, id))
                    strings[id].push (doc);
                else
                    strings[id] = [ doc ];
            else if (idType == 'number')
                if (Object.hasOwnProperty.call (nums, id))
                    nums[id].push (doc);
                else
                    nums[id] = [ doc ];
            else {
                var done = false;
                for (var i in others)
                    if (matchQuery.matchLeaves (id, others[i])) {
                        done = true;
                        otherDocs[i].push (doc);
                        break;
                    }
                if (!done) {
                    others.push (id);
                    otherDocs.push ([ doc ]);
                }
            }
        }

        // assemble the groups into a single manageable task
        var jobs = others;
        var jobDocLists = otherDocs;
        var stringIDs = Object.keys (strings);
        var numIDs = Object.keys (nums);
        jobs.push.apply (jobs, stringIDs);
        jobs.push.apply (jobs, numIDs);
        for (var i in stringIDs)
            jobDocLists.push (strings[stringIDs[i]]);
        for (var i in numIDs)
            jobDocLists.push (nums[numIDs[i]]);

        // accumulate each group
        var output = [];
        for (var i in jobs) {
            var jobID = jobs[i];
            var jobDocs = jobDocLists[i];
            var accumulant = { _id:jobID };

            for (var key in expression) {
                if (key == '_id')
                    continue;

                var subexpression = expression[key];
                var sxkeys = Object.keys (subexpression);
                if (
                    !sxkeys.length
                 || !Object.hasOwnProperty.call (AggregationOperators.accumulators, sxkeys[0])
                )
                    throw new FauxmongoError (
                        'INVALID',
                        '$group found an invalid aggregation spec'
                    );

                var currentVal = Object.hasOwnProperty.call (accumulant, key) ?
                    accumulant[key]
                  : undefined
                  ;

                accumulant[key] = AggregationOperators.accumulators[sxkeys[0]] (
                    subexpression[sxkeys[0]],
                    jobDocs
                );
            }

            output.push (accumulant);
        }

        return output;
    },
    '$limit':       function (docs, expression) {
        return docs.slice (0, expression);
    },
    '$match':       function (docs, expression) {
        var output = [];
        for (var i=0,j=docs.length; i<j; i++)
            if (matchQuery (docs[i], expression))
                output.push (docs[i]);
        return output;
    },
    '$project':     function (docs, expression) {
        var output = [];
        for (var i in docs) {
            var currentDoc = docs[i];
            var context = { CURRENT:currentDoc };
            var dotsBanned = false;
            var layersBanned = false;
            var newDoc = {};
            for (var key in expression) {
                if (key == '_id') {
                    var val = expression[key]
                    if (val === 0 || val === false)
                        continue;
                }

                var spec = expression[key];
                if (typeof spec == 'object' && !(spec instanceof Array)) {
                    var specKeys = Object.keys (spec);
                    if (specKeys[0] && specKeys[0][0] == '$') {
                        newDoc[key] = evaluate (spec, context);
                        continue;
                    }

                    // layer!
                    if (layersBanned)
                        throw new FauxmongoError (
                            'INVALID',
                            '$project cannot combine dot-notation and layered spec'
                        );
                    dotsBanned = true;

                    var subdoc = Object.hasOwnProperty.call (currentDoc, key) ?
                        currentDoc[key]
                      : undefined
                      ;
                    var layerProjection = (function projectLevel (doc, layer) {
                        var projection = {};
                        var didSomething = false;
                        for (var key in layer) {
                            var spec = layer[key];
                            if (typeof spec == 'object' && !(spec instanceof Array)) {
                                var specKeys = Object.keys (spec);
                                if (specKeys[0] && specKeys[0][0] == '$') {
                                    projection[key] = AggregationOperators.evaluate (
                                        spec,
                                        context
                                    );
                                    didSomething = true;
                                } else
                                    for (var j in specKeys) {
                                        var specKey = specKeys[j];
                                        var subdoc =
                                                doc
                                             && Object.hasOwnProperty.call (doc, specKey) ?
                                            doc[specKey]
                                          : undefined
                                          ;
                                        var levelProjection = projectLevel (
                                            subdoc,
                                            spec[specKey],
                                            projection[specKey] = {}
                                        );
                                        if (levelProjection !== undefined) {
                                            didSomething = true;
                                            projection[specKey] = levelProjection;
                                        }
                                    }
                                continue;
                            }

                            if (spec === 1 || spec === true) {
                                if (doc && Object.hasOwnProperty.call (doc, key)) {
                                    projection[key] = doc[key];
                                    didSomething = true;
                                }
                            } else {
                                projection[key] = AggregationOperators.evaluate (
                                    spec,
                                    context
                                );
                                didSomething = true;
                            }
                        }

                        if (didSomething)
                            return projection;
                    }) (subdoc, spec);
                    if (layerProjection !== undefined)
                        newDoc[key] = layerProjection;
                    continue;
                }

                var isExpression = spec === 1 || spec === true ? false : true;

                var pointer = docs[i];
                var writeHead = newDoc;
                var lastStep;
                var frags = key.split ('.');
                if (frags.length > 1 && dotsBanned)
                    throw new FauxmongoError (
                        '$project cannot combine dot-notation and layered spec',
                        'INVALID'
                    );
                layersBanned = true;
                var notFound = false;
                for (var k=0,l=frags.length-1; k<l; k++) {
                    var frag = frags[k];
                    if (!Object.hasOwnProperty.call (pointer, frag)) {
                        if (!isExpression) {
                            notFound = true;
                            break;
                        }
                    } else
                        pointer = pointer[frag];
                    if (!Object.hasOwnProperty.call (writeHead, frag))
                        if (pointer[frag] instanceof Array)
                            writeHead[frag] = [];
                        else
                            writeHead[frag] = {};
                    writeHead = writeHead[frag];
                }
                if (notFound) // skip this key in the projection
                    continue;
                lastStep = frags[frags.length-1];

                if (isExpression)
                    writeHead[lastStep] = AggregationOperators.evaluate (spec, context);
                else if (Object.hasOwnProperty.call (pointer, lastStep))
                    writeHead[lastStep] = pointer[lastStep];
            }

            output.push (newDoc);
        }

        return output;
    },
    '$redact':      function (docs, expression) {
        var output = [];

        for (var i in docs) {
            var doc = docs[i];
            var context = { CURRENT:doc, DESCEND:{}, KEEP:{}, PRUNE:{} };
            var action = AggregationOperators.evaluate (expression, context);
            if (action === context.PRUNE)
                continue;
            if (action === context.KEEP) {
                output.push (doc);
                continue;
            }
            if (action !== context.DESCEND)
                throw new FauxmongoError (
                    'INVALID',
                    '$redact expects one of $$PRUNE, $$KEEP, $$DESCEND'
                );

            // DESCEND
            newDoc = {};
            for (var key in doc) {
                var val = doc[key];
                if (typeof val != 'object') {
                    newDoc[key] = doc[key];
                    continue;
                }

                var redacted = (function redactLevel (readHead) {
                    if (readHead instanceof Array) {
                        var newDoc = [];
                        for (var i in readHead) {
                            var val = readHead[i];
                            if (typeof val != 'object')
                                newDoc.push (val);
                            else {
                                var newVal = redactLevel (val);
                                if (newVal !== undefined)
                                    newDoc.push (newVal);
                            }
                        }
                        if (newDoc.length)
                            return newDoc;
                        return;
                    }

                    context.CURRENT = readHead;
                    var action = AggregationOperators.evaluate (expression, context);
                    if (action === context.PRUNE)
                        return;
                    if (action === context.KEEP)
                        return readHead;
                    if (action !== context.DESCEND)
                        throw new FauxmongoError (
                            'INVALID',
                            '$redact expects one of $$PRUNE, $$KEEP, $$DESCEND'
                        );

                    var newDoc = {}
                    var keys = Object.keys (readHead);
                    for (var i in keys) {
                        var key = keys[i];
                        var val = readHead[key];
                        if (typeof val != 'object')
                            newDoc[key] = val;
                        else {
                            var newVal = redactLevel (val);
                            if (newVal !== undefined)
                                newDoc[key] = newVal;
                        }
                    }
                    if (Object.keys (newDoc).length)
                        return newDoc;
                }) (val, newDoc, key);

                if (redacted !== undefined)
                    newDoc[key] = redacted;
            }

            output.push (newDoc);
        }

        return output;
    },
    '$skip':        function (docs, expression) {
        return docs.slice (expression);
    },
    '$sort':        function (docs, expression) {
        var output = [];
        output.push.apply (output, docs);
        output.sort (Sorting.getDocsort (expression));
        return output;
    },
    '$unwind':      function (docs, path) {
        var output = [];

        var frags = path.slice (1).split ('.');
        for (var i=0,j=docs.length; i<j; i++) {
            var doc = docs[i];

            // walk to the target array
            var pointer = docs[i];
            var notFound = false;
            for (var k in frags) {
                var frag = frags[k];
                if (!Object.hasOwnProperty.call (pointer, frag)) {
                    notFound = true;
                    break;
                }
                pointer = pointer[frag];
                if (typeof pointer != 'object')
                    throw new FauxmongoError (
                        'FORMAT',
                        '$unwind found something other than an Array'
                    );
            }
            if (notFound)
                continue;
            if (!(pointer instanceof Array))
                throw new FauxmongoError (
                    'FORMAT',
                    '$unwind found something other than an Array'
                );

            // unwind
            var newDocs = [];
            for (var k in pointer) {
                newDoc = clone (doc);
                // walk to the unwound path and set an individual value there
                var innerPointer = newDoc;
                for (var l=0,m=frags.length-1; l<m; l++)
                    innerPointer = innerPointer[frags[l]];
                innerPointer[frags[frags.length-1]] = pointer[k];
                newDocs.push (newDoc);
            }
            output.push.apply (output, newDocs);
        }

        return output;
    }
};

module.exports = AggregationStages;

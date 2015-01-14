
var fauxmongo = require ('../../fauxmongo');
var Mongo = require ('mongodb');
var async = require ('async');

var typeGetter = ({}).toString;
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object')
        if (obj instanceof Buffer) return 'buffer';
        else return tstr;
    if (tstr == 'text') return 'textnode';
    if (tstr == 'comment') return 'commentnode';
    if (tstr.slice(0,4) == 'html') return 'element';
    return tstr;
}
function deepCompare (able, baker) {
    if (able === baker) return true;
    var type = getTypeStr (able);
    if (type != getTypeStr (baker)) return false;
    if (type == 'object' || type == 'array') {
        if (type == 'object') {
            if (Object.keys (able).length != Object.keys (baker).length) return false;
        } else if (able.length != baker.length) return false;
        for (var key in able)
            if (!deepCompare (able[key], baker[key])) return false;
        return true;
    }
    return able == baker;
}

var alreadyStarted = false;
var collection;
function start (done) {
    if (alreadyStarted)
        return process.nextTick (done);
    alreadyStarted = true;

    var dbsrv = new Mongo.Server ('127.0.0.1', 27017);
    var db = new Mongo.Db (
        'test-fauxmongo',
        dbsrv,
        { w:0 }
    );
    db.open (function (err) {
        if (err) {
            console.log ('could not connect to MongoDB at 127.0.0.1:27017');
            return process.exit (1);
        }
        db.collection ('test-fauxmongo', function (err, col) {
            if (err) {
                console.log ('could not connect to MongoDB at 127.0.0.1:27017');
                return process.exit (1);
            }

            collection = col;
            collection.remove ({}, { w:1 }, function (err) {
                if (err) {
                    console.log ('could not clear MongoDB test collection');
                    return process.exit (1);
                }
                done();
            });
        });
    });
}

var nextID = 1;
function getNextID(){ return 'tempID_'+nextID++; }

function testQuery (doc, query, callback) {
    var _id = query._id = doc._id = getNextID();
    collection.insert (doc, { w:1 }, function (err) {
        collection.findOne (query, function (err, rec) {
            collection.remove ({ _id:_id });
            if (err) return callback (err);

            try {
                var fauxpinion = fauxmongo.matchQuery (doc, query);
            } catch (err) {
                return callback (err);
            }
            if (rec && !fauxpinion)
                return process.nextTick (function(){
                    callback (new Error ('MongoDB found the document but fauxmongo did not'));
                });
            if (!rec && fauxpinion)
                return process.nextTick (function(){
                    callback (new Error ('fauxmongo found the document but MongoDB did not'));
                });
            callback();
        });
    });
}

function testUpdate (query, target, update, callback) {
    if (!callback) {
        callback = update;
        update = target;
        target = query;
        query = {};
    }

    var _id = query._id = target._id = getNextID();
    collection.insert (target, { w:1 }, function (err) {
        if (err) return callback (err);
        try {
            collection.update (query, update, { w:1 }, function (err) {
                if (err)
                    if (!err.code)
                        return callback (err);
                    else
                        // if the driver throws an Error, fauxmongo must throw an Error
                        try {
                            fauxmongo.update (query, target, update);
                            return callback (err);
                        } catch (err) {
                            return callback();
                        }
                collection.findOne ({ _id:_id }, function (err, rec) {
                    collection.remove ({ _id:_id });
                    if (err) return callback (err);

                    fauxmongo.update (query, target, update);
                    if (deepCompare (target, rec))
                        return callback();
                    process.nextTick (function(){
                        callback (new Error (
                            'database and fauxmongo did not agree.\n'
                          + 'fauxmongo\n'
                          + JSON.stringify (target)
                          + '\nmongodb\n'
                          + JSON.stringify (rec)
                        ));
                    });
                });
            });
        } catch (err) {
            // if the driver throws an Error, fauxmongo must throw an Error
            try {
                fauxmongo.update (query, target, update);
                return callback (err);
            } catch (err) {
                callback();
            }
        }
    });
}

function testProject (document, query, projection, callback) {
    var _id = document._id = getNextID();
    if (query) query._id = _id;
    else query = { _id:_id };

    collection.insert (document, { w:1 }, function (err) {
        if (err) return callback (err);
        collection.findOne (query, projection, function (err, actual) {
            if (err) return callback (err);
            var sample = fauxmongo.project (document, query, projection);
            sample._id = _id;
            if (!deepCompare (sample, actual))
                return callback (new Error (
                    'database and fauxmongo did not agree.\n'
                  + 'fauxmongo\n'
                  + JSON.stringify (sample)
                  + '\nmongodb\n'
                  + JSON.stringify (actual)
                ));
            callback();
        });
    });
}

function testMerge (document, query, update, target, goal, projection, callback) {
    if (!projection) {
        projection = target;
        callback = goal;
        target = goal = undefined;
    } else if (!callback) {
        callback = projection;
        projection = goal;
        goal = undefined;
    }

    var _id = document._id = getNextID();
    if (query) query._id = _id;
    else query = { _id:_id };
    if (goal) goal._id = _id;

    collection.insert (document, { w:1 }, function (err) {
        if (err) return callback (err);
        collection.update (
            query,
            update,
            { w:1 },
            function (err) {
                if (err) return callback (err);
                collection.findOne (query, projection, function (err, actual) {
                    collection.findOne ({ _id:_id }, function (err, fullActual) {
                        if (err) return callback (err);
                        fauxmongo.merge (actual, target || document, query, projection);
                        if (!deepCompare (target || document, goal || fullActual))
                            return callback (new Error (
                                'incorrect merge result - '
                              + JSON.stringify (target || document)
                              + ' vs '
                              + JSON.stringify (goal || fullActual)
                            ));
                        callback();
                    });
                });
            }
        );
    });
}

function matchLeaves (able, baker, arraysAsSets) {
    if (able === baker) return true;

    var aType = getTypeStr (able);
    var bType = getTypeStr (baker);
    if (aType != bType) return false;
    if (aType == 'array') {
        if (able.length != baker.length) return false;
        if (!arraysAsSets) {
            for (var i in able)
                if (!matchLeaves (able[i], baker[i], arraysAsSets))
                    return false;
            return true;
        }
        for (var i in able) {
            var found = false;
            for (var j in baker) {
                if (matchLeaves (able[i], baker[j], arraysAsSets)) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    } else if (aType == 'object') {
        var keys = Object.keys (able);
        if (keys.length != Object.keys (baker).length) return false;
        for (var i in keys) {
            var key = keys[i];
            if (
                !Object.hasOwnProperty.call (baker, key)
             || !matchLeaves (able[key], baker[key], arraysAsSets)
            )
                return false;
        }
        return true;
    } else return false;
}

function testAggregation (documents, pipeline, callback, arraysAsSets) {
    var outerCheck = JSON.stringify (documents);
    try {
        var stages = fauxmongo.aggregate (documents, pipeline, true);
        var finalStage = stages[stages.length-1];
        if (JSON.stringify (documents) != outerCheck)
            return callback (new Error ('damaged the input'));
    } catch (err) {
        console.log (err);
        throw err;
    }

    collection.remove ({}, { w:1, sync:true }, function (err) {
        if (err) return callback (err);
        async.each (documents, function (doc, callback) {
            collection.insert (doc, { w:1 }, callback);
        }, function (err) {
            if (err) return callback (err);
            collection.aggregate (pipeline, function (err, recs) {
                if (err) return callback (err);

                for (var i in finalStage) delete finalStage[i]._id;
                for (var i in recs) delete recs[i]._id;

                if (recs.length != finalStage.length) {
                    console.log (finalStage);
                    console.log (recs);
                    return callback (new Error ('fauxmongo produced incorrect number of records'));
                }

                for (var i=0,j=recs.length; i<j; i++) {
                    var candidate = recs[i];
                    delete candidate._id;
                    var found = false;
                    for (var k in finalStage)
                        if (matchLeaves (candidate, finalStage[k], true)) {
                            found = true;
                            break;
                        }
                    if (!found) {
                        console.log (JSON.stringify (finalStage));
                        console.log (JSON.stringify (recs));
                        return callback (new Error ('fauxmongo and mongodb disagreed'));
                    }
                }

                callback();
            });
        });
    });
}

function testAggregationFailure (documents, pipeline, errDef) {
    var outerCheck = JSON.stringify (documents);
    try {
        var stages = fauxmongo.aggregate (documents, pipeline, true);
        var finalStage = stages[stages.length-1];
        if (JSON.stringify (documents) != outerCheck)
            return callback (new Error ('damaged the input'));
    } catch (err) {
        if (!(err instanceof fauxmongo.FauxmongoError))
            throw err;
        for (var key in errDef)
            if (err[key] !== errDef[key])
                throw new Error (
                    'throw Error did not match spec on key "'+key+'" (',
                    err[key],
                    '!=',
                    errDef[key]
                );
        return;
    }

    throw new Error ('fauxmongo did not throw an Error');
}

module.exports.start                    = start;
module.exports.testQuery                = testQuery;
module.exports.testUpdate               = testUpdate;
module.exports.testProject              = testProject;
module.exports.testMerge                = testMerge;
module.exports.testAggregation          = testAggregation;
module.exports.testAggregationFailure   = testAggregationFailure;

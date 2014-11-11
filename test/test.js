
var async = require ('async');
var fauxmongo = require ('../fauxmongo');
var Mongo = require ('mongodb');

var typeGetter = ({}).toString;
try { Buffer; } catch (err) { Buffer = function(){}; }
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
        if (Object.keys (able).length != Object.keys (baker).length) return false;
        for (var key in able)
            if (!deepCompare (able[key], baker[key])) return false;
        return true;
    }
    return able == baker;
}

before (function (done) {
    var dbsrv = new Mongo.Server ('127.0.0.1', 27017);
    db = new Mongo.Db (
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
});

var nextID = 1;
function getNextID(){ return 'tempID_'+nextID++; }

// ========================================================================================= queries
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
describe ("queries", function(){
    describe ("simple values", function(){
        it ("selects by a single shallow path", function (done) {
            testQuery (
                { able:9, baker:'this', charlie:'that' },
                { baker:'this' },
                done
            );
        });
        it ("selects by a single deep path", function (done) {
            testQuery (
                { able:9, baker:{ baker:99, able:{ able:72 }}},
                { 'baker.able.able':72 },
                done
            );
        });
        it ("selects by multiple deep paths", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { 'baker.able.able':72, 'baker.charlie.able.able':7 },
                done
            );
        });
        it ("excludes by a single shallow path", function (done) {
            testQuery (
                { able:9, baker:'this', charlie:'that' },
                { able:'this', baker:'this' },
                done
            );
        });
        it ("excludes by a single deep path, with valid deep paths", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { 'baker.able.able':72, 'baker.charlie.able.able':"7" },
                done
            );
        });
    });
    describe ("$in/$nin", function(){
        it ("selects by $in", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { able:{ $in:[ 6, 7, 8, 9, 10, 11 ] }},
                done
            );
        });
        it ("excludes by $in", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { able:{ $in:[ 6, 7, 8, 10, 11 ] }},
                done
            );
        });
        it ("selects by $nin", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { able:{ $nin:[ 6, 7, 8, 10, 11 ] }},
                done
            );
        });
        it ("excludes by $nin", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { able:{ $nin:[ 6, 7, 8, 9, 10, 11 ] }},
                done
            );
        });
        it ("selects by $nin for multiple paths", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                {
                    able:                       { $nin:[ 6, 7, 8, 10, 11 ] },
                    'baker.charlie.able.able':  { $nin:[ 6, 8, 9, 10, 11 ] }
                },
                done
            );
        });
        it ("excludes by $nin for multiple paths", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                {
                    able:                       { $nin:[ 6, 7, 8, 9, 10, 11 ] },
                    'baker.charlie.able.able':  { $nin:[ 6, 8, 9, 10, 11 ] }
                },
                done
            );
        });
    });
    describe ("$gt(e)/$lt(e)", function(){
        it ("selects by $gt", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $gt:7 }},
                done
            );
        });
        it ("excludes by $gt when equal", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $gt:9 }},
                done
            );
        });
        it ("selects by $gte", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $gte:7}},
                done
            );
        });
        it ("selects by $gte when equal", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $gte:9 }},
                done
            );
        });
        it ("selects by $lt", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $lt:12 }},
                done
            );
        });
        it ("excludes by $lt when equal", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $lt:9 }},
                done
            );
        });
        it ("selects by $lte", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $lte:12}},
                done
            );
        });
        it ("selects by $lte when equal", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}}},
                { able:{ $lte:9 }},
                done
            );
        });
    });
    describe ("$ne", function(){
        it ("selects", function (done) {
            testQuery (
                { able:9 },
                { able:{ $ne:8 }},
                done
            );
        });
        it ("excludes", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { able:{ $ne:9 }},
                done
            );
        });
        it ("selects without coersion issues", function (done) {
            testQuery (
                { able:9 },
                { able:{ $ne:'9' }},
                done
            );
        });
        it ("selects without coersion issues", function (done) {
            testQuery (
                { able:'9' },
                { able:{ $ne:9 }},
                done
            );
        });
    });
    describe ("$mod", function(){
        it ("selects", function (done) {
            testQuery (
                { able:39 },
                { able:{ $mod:[ 10, 9 ] }},
                done
            );
        });
        it ("excludes", function (done) {
            testQuery (
                { able:39 },
                { able:{ $mod:[ 10, 8 ] }},
                done
            );
        });
    });
    describe ("$regex", function(){
        it ("selects", function (done) {
            testQuery (
                { able:'asdf' },
                { able:{ $regex:/\w+/ }},
                done
            );
        });
        it ("excludes", function (done) {
            testQuery (
                { able:'asdf' },
                { able:{ $regex:/\d+/ }},
                done
            );
        });
    });
    describe ("$elemMatch", function(){
        it ("selects", function (done) {
            testQuery (
                { able:[
                    { able:0 },
                    { able:1 },
                    { able:2 },
                    { able:3 },
                    { able:4 },
                    { able:5 },
                    { able:6 },
                    { able:7 },
                    { able:8 },
                    { able:9 }
                ] },
                { able:{ $elemMatch:{ able:{ $gt:2, $lt:4 } }}},
                done
            );
        });
        it ("excludes", function (done) {
            testQuery (
                { able:[
                    { able:0 },
                    { able:1 },
                    { able:2 },
                    { able:4 },
                    { able:5 },
                    { able:6 },
                    { able:7 },
                    { able:8 },
                    { able:9 }
                ] },
                { able:{ $elemMatch:{ able:{ $gt:2, $lt:4 } }}},
                done
            );
        });
    });
    describe ("$size", function(){

    });
    describe ("$all", function(){
        it ("selects with basic values", function (done) {
            testQuery (
                { able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ] },
                { able:{ $all:[ 2, 4, 6 ] }},
                done
            );
        });
        it ("excludes with basic values", function (done) {
            testQuery (
                { able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ] },
                { able:{ $all:[ 2, 4, 6, 10 ] }},
                done
            );
        });
        it ("selects with complex leaves", function (done) {
            testQuery (
                { able:[
                    { able:0 },
                    { able:1 },
                    { able:2 },
                    { able:4 },
                    { able:5 },
                    { able:6 },
                    { able:7 },
                    { able:8 },
                    { able:9 }
                ] },
                { able:{ $all:[ { able:2 }, { able:4 }, { able:6 } ] }},
                done
            );
        });
        it ("excludes with complex leaves", function (done) {
            testQuery (
                { able:[
                    { able:0 },
                    { able:1 },
                    { able:2 },
                    { able:4 },
                    { able:5 },
                    { able:6 },
                    { able:7 },
                    { able:8 },
                    { able:9 }
                ] },
                { able:{ $all:[ { able:2 }, { able:6 }, { able:10 } ] }},
                done
            );
        });
    });
    describe ("logical operators", function(){
        describe ("$and", function(){

        });
        describe ("$or", function(){

        });
        describe ("$not", function(){

        });
        describe ("$nor", function(){

        });
        describe ("complex logical operators", function(){

        });
    });

});

// ================================================================================= updates
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


describe ("updates", function(){
    describe ("$set", function(){
        it ("sets new keys in the document", function (done) {
            testUpdate (
                { able:42, baker:{} },
                { $set:{ 'baker.able':9, charlie:12 }},
                done
            );
        });
        it ("infills Objects to set new keys in the document", function (done) {
            testUpdate (
                { able:9, baker:{} },
                { $set:{ 'baker.able.able':99, 'charlie.easy':42 }},
                done
            );
        });
        it ("does not infill Object when data is in the way", function (done) {
            testUpdate (
                { able:9, baker:{able:9 }},
                { $set:{ 'able.baker':'foo', 'baker.able.charlie':'foo' }},
                done
            );
        });
        it ("overwrites keys in the document", function (done) {
            testUpdate (
                { able:99, charlie:'cheese' },
                { $set:{ able:7, dog:'value' }},
                done
            );
        });
    });
    describe ("$unset", function(){
        it ("deletes keys from the document", function (done) {
            testUpdate (
                { able:9, baker:{ dog:42 }},
                { $unset:{ able:true, 'baker.dog':true }},
                done
            );
        });
    });
    describe ("$rename", function(){
        it ("renames keys in the document", function (done) {
            testUpdate (
                { able:1, baker:2, charlie:{ able:9 }},
                { $rename:{ able:'dog', baker:'easy', 'charlie.able':'foo.bar.baz' }},
                done
            );
        });
        it ("does nothing when asked to rename a missing key", function (done) {
            testUpdate (
                { able:1, baker:2 },
                { $rename:{ charlie:'foo' }},
                done
            );
        });
        it ("throws an Error when original path attempts to traverse data", function (done) {
            testUpdate (
                { able:1, baker:2 },
                { $rename:{ 'able.baker.charlie':'bar' }},
                done
            );
        });
        it ("throws an Error when multiple renames target the same path", function (done) {
            testUpdate (
                { able:5, baker:6 },
                { $rename:{ able:'charlie', baker:'charlie' }},
                done
            );
        });
    });
    describe ("$inc", function(){
        it ("increments existing numbers", function (done) {
            testUpdate (
                { able:4, baker:9, charlie:{ able:7, baker:{ able:5 }}},
                { $inc:{ able:1, baker:-3, 'charlie.able':4, 'charlie.baker.able':-99 }},
                done
            );
        });
        it ("upserts new numbers", function (done) {
            testUpdate (
                { able:5, baker:7 },
                { $inc:{ baker:-1, charlie:5, 'zebra.horse':4 }},
                done
            );
        });
    });
    describe ("$max", function(){
        it ("sets the new value, if greater", function (done) {
            testUpdate (
                { able:4, baker:10, charlie:{ able:4, baker:9 }},
                { $max:{ able:7, baker:17, 'charlie.able':5, 'charlie.baker':11 }},
                done
            );
        });
        it ("does not set the new value, if not greater", function (done) {
            testUpdate (
                { able:4, baker:10, charlie:{ able:4, baker:9 }},
                { $max:{ able:2, baker:2, 'charlie.able':2, 'charlie.baker':2 }},
                done
            );
        });
        it ("upserts new numbers", function (done) {
            testUpdate (
                { able:4, charlie:{ able:4 }},
                { $max:{ able:7, baker:17, 'charlie.able':3, 'charlie.baker':11 }},
                done
            );
        });
    });
    describe ("$min", function(){
        it ("sets the new value, if less", function (done) {
            testUpdate (
                { able:4, baker:10, charlie:{ able:4, baker:9 }},
                { $min:{ able:2, baker:2, 'charlie.able':2, 'charlie.baker':2 }},
                done
            );
        });
        it ("does not set the new value, if not less", function (done) {
            testUpdate (
                { able:4, baker:10, charlie:{ able:4, baker:9 }},
                { $min:{ able:7, baker:17, 'charlie.able':5, 'charlie.baker':11 }},
                done
            );
        });
        it ("upserts new numbers", function (done) {
            testUpdate (
                { able:4, charlie:{ able:4 }},
                { $min:{ able:7, baker:17, 'charlie.able':3, 'charlie.baker':11 }},
                done
            );
        });
    });
    describe ("$mul", function(){
        it ("multiplies existing numbers", function (done) {
            testUpdate (
                { able:4, baker:10, charlie:{ able:4, baker:9 }},
                { $mul:{ able:2, baker:2, 'charlie.able':2, 'charlie.baker':2 }},
                done
            );
        });
        it ("upserts new numbers", function (done) {
            testUpdate (
                { able:4, charlie:{ able:4 }},
                { $mul:{ able:7, baker:17, 'charlie.able':3, 'charlie.baker':11 }},
                done
            );
        });
    });
    describe ("$currentDate", function(){
        it ("sets a key to the current date", function(){
            var testDoc = { able:4, charlie:{}};
            fauxmongo.update (
                testDoc,
                { $currentDate:{ able:true, baker:true, 'charlie.able':true }}
            );
        });
    });
    describe ("$bit", function(){
        describe ("and", function(){
            it ("updates existing numbers", function (done) {
                testUpdate (
                    { able:5, baker:7, charlie:{ able:5 }},
                    { $bit:{and:{ able:2, baker:2, 'charlie.able':2 }}},
                    done
                );
            });
            it ("upserts new numbers", function (done) {
                testUpdate (
                    { able:5 },
                    { $bit:{and:{ able:2, baker:2, 'charlie.able':2 }}},
                    done
                );
            });
        });
        describe ("or", function(){
            it ("updates existing numbers", function (done) {
                testUpdate (
                    { able:5, baker:7, charlie:{ able:5 }},
                    { $bit:{or:{ able:2, baker:2, 'charlie.able':2 }}},
                    done
                );
            });
            it ("upserts new numbers", function (done) {
                testUpdate (
                    { able:5 },
                    { $bit:{or:{ able:2, baker:2, 'charlie.able':2 }}},
                    done
                );
            });
        });
        describe ("xor", function(){
            it ("updates existing numbers", function (done) {
                testUpdate (
                    { able:5, baker:7, charlie:{ able:5 }},
                    { $bit:{xor:{ able:2, baker:2, 'charlie.able':2 }}},
                    done
                );
            });
            it ("upserts new numbers", function (done) {
                testUpdate (
                    { able:5 },
                    { $bit:{xor:{ able:2, baker:2, 'charlie.able':2 }}},
                    done
                );
            });
        });
        describe ("combo updates", function(){
            it ("performs multiple $bit operations", function (done) {
                testUpdate (
                    { able:5 },
                    { $bit:{ or:2, xor:2, and:5 }},
                    done
                );
            });
            it ("uses document order for multiple $bit operations", function (done) {
                testUpdate (
                    { able:5 },
                    { $bit:{ xor:2, and:5, or:2 }},
                    done
                );
            });
        });
    });
    describe ("$push", function(){
        it ("adds values to Arrays", function (done) {
            testUpdate (
                { able:[ 0, 1 ], baker:{ able:[ 0, 1 ]}},
                { $push:{ able:3, 'baker.able':5 }},
                done
            );
        });
        it ("infills missing Arrays", function (done) {
            testUpdate (
                { able:[ 0, 1], charlie:{} },
                { $push:{ able:3, baker:4, 'charlie.able':5 }},
                done
            );
        });
        it ("throws an Error when updating non-Arrays", function (done) {
            testUpdate (
                { able:5 },
                { $push:{ able:5 }},
                done
            );
        });
    });
    describe ("$pull", function(){
        it ("removes values from an Array", function (done) {
            testUpdate (
                { able:[ 0, 1, 1, 2 ], baker:{ able:[ 0, 9, 9, 1, 2, 9, 5 ]}},
                { $pull:{ able:1, 'baker.able':9 }},
                done
            );
        });
        it ("removes documents matching a query from an Array", function (done) {
            testUpdate (
                { able:[ { a:1 }, { a:2 }, { a:3 }, { a:4 } ]},
                { $pull:{ able:{ a:{ $gt:1 }}}},
                done
            );
        });
        it ("throws an Error when updating non-Arrays", function (done) {
            testUpdate (
                { able:9 },
                { $pull:{ able:9 }},
                done
            );
        });
    });
    describe ("$pullAll", function(){
        it ("removes identical documents from an Array", function (done) {
            testUpdate (
                { able:[ { a:1 }, { a:2 }, { a:2, b:1 }, { a:3 }, { a:4 } ]},
                { $pullAll:{ able:[ { a:2 }, { a:3 } ]}},
                done
            );
        });
        it ("removes identical values from an Array", function (done) {
            testUpdate (
                { able:[ 1, 3, 5, [ 0, { a:1 } ], { a:2 }, 'chickens' ]},
                { $pullAll:{ able:[ 5, [ 0, { a:1 } ], 'chickens' ]}},
                done
            );
        });
        it ("throws an Error when updating non-Arrays", function (done) {
            testUpdate (
                { able:9 },
                { $pullAll:{ able:[ { a:9 } ]}},
                done
            );
        });
    });
    describe ("$addToSet", function(){
        it ("adds only unique values", function (done) {
            testUpdate (
                { able:[ 0, 1, 2 ], baker:[ 0, 1, 2 ], charlie:{ able:[ 0, 1, 2 ], baker:[ 1, 2 ]}},
                { $addToSet:{ able:2, baker:4, 'charlie.able':5, 'charlie.baker':2 }},
                done
            );
        });
        it ("infills missing Objects", function (done) {
            testUpdate (
                { able:{} },
                { $addToSet:{ 'able.baker.charlie':7 }},
                done
            );
        });
        it ("throws an Error when updating non-Arrays", function (done) {
            testUpdate (
                { able:9 },
                { $addToSet:{ able:8 }},
                done
            );
        });
    });
    describe ("$each", function(){
        describe ("$push", function(){
            it ("inserts multiple values", function (done) {
                testUpdate (
                    { able:[ 0, 1, 2 ]},
                    { $push:{ able:{ $each:[ 3, 4, 5, 'George Foreman' ]}}},
                    done
                );
            });
        });
        describe ("$pull", function(){
            it ("pulls values matching one of multiple queries", function (done) {
                testUpdate (
                    { able:[ { a:1 }, { a:2 }, { a:3 }, { a:4 }, { a:5 }, { a:6 }, { a:7 } ]},
                    { $pull:{ able:{ $each:[ { a:{ $lt:2 } }, { a:{ $gte:5 }} ]}}},
                    done
                );
            });
        });
        describe ("$addToSet", function(){
            it ("inserts multiple values, only if unique", function (done) {
                testUpdate (
                    { able:[ 0, 1, 2, 3, 'Peyton Manning', { d:3 } ]},
                    { $addToSet:{ able:{ $each:[ 3, 'George Foreman', { d:3 }, { d:3, a:1 } ]}}},
                    done
                );
            });
        });
    });
    describe ("$slice", function(){
        it ("keeps the first few values", function (done) {
            testUpdate (
                { able:[ 0, 1, 2, 3, 4, 5, 6 ]},
                { $push:{ able:{ $each:[], $slice:-3 }}},
                done
            );
        });
        it ("keeps the last few values", function (done) {
            testUpdate (
                { able:[ 0, 1, 2, 3, 4, 5, 6 ]},
                { $push:{ able:{ $each:[], $slice:4 }}},
                done
            );
        });
        it ("doesn't affect short Arrays", function (done) {
            testUpdate (
                { able:[ 0, 1, 2, 3, 4, 5, 6 ]},
                { $push:{ able:{ $each:[], $slice:-15 }}},
                done
            );
        });
    });
    describe ("$position", function(){
        it ("inserts value at specified position", function (done) {
            testUpdate (
                { able:[ 0, 1, 2, 3, 4, 5, 6 ]},
                { $push:{ able:{ $each:[ 9 ], $position:3 }}},
                done
            );
        });
        it ("appends value when specified position exceeds length", function (done) {
            testUpdate (
                { able:[ 0, 1, 2, 3, 4, 5, 6 ]},
                { $push:{ able:{ $each:[ 9 ], $position:40 }}},
                done
            );
        });
        it ("throws an error if the specified position is negative", function (done) {
            testUpdate (
                { able:[ 0, 1, 2, 3, 4, 5, 6 ]},
                { $push:{ able:{ $each:[ 9 ], $position:-1 }}},
                done
            );
        });
    });
    describe ("$sort", function(){
        it ("sorts simple values", function (done) {
            testUpdate (
                { able:[ 'able', 'baker', 'charlie', 'dog' ]},
                { $push:{ able:{ $each:[], $sort:-1 }}},
                done
            );
        });
        it ("performs complex sorts", function (done) {
            testUpdate (
                { able:[ { a:1, b:9 }, { a:1, b:10 }, { a:1, b:11 }, { a:2, b:3 }, { a:2, b:7 } ]},
                { $push:{ able:{ $each:[], $sort:{ a:1, b:-1 }}}},
                done
            );
        });
        it ("sorts mixed values", function (done) {
            testUpdate (
                {
                    able:   [
                        9001,
                        { a:3, b:4 },
                        { a:2, b:6 },
                        'aardvark',
                        { b:9, a:1 },
                        /goto/g,
                        42,
                        { c:15, a:-9 },
                        new Buffer ([ 3, 5, 7 ]),
                        [ 15, 17, 19 ],
                        3333.333,
                        'bacon sandwich',
                        /eels/,
                        new Buffer ([ 3, 5, 7, 9 ]),
                        new Buffer ([ 0, 1, 1 ]),
                        5,
                        [ 6 ],
                        7,
                        [ 8 ],
                        9
                    ]
                },
                { $push:{ $each:[], $sort:1 }},
                done
            );
        });
    });
    describe ("$sort/$slice", function(){
        it ("sorts before slicing", function (done) {
            testUpdate (
                { able:[ 1, 6, 4, 2, 7, 5, 4, 7, 3, 6, 1, 8, 9, 6, 5, 3, 6, 5, 2 ] },
                { $push:{ able:{ $each:[], $slice:-5, $sort:-1 }}},
                done
            );
        });
    });
    describe ("positional operator", function(){
        it ("performs an update at the position of a simple Array query", function (done) {
            testUpdate (
                { 'able.able':2 },
                { able:[ { able:1 }, { able:2 } ]},
                { $inc:{ 'able.$.able':5 }},
                done
            );
        });
        it ("performs an update at the position of a complex Array query", function (done) {
            testUpdate (
                { 'able.able':{ $gt:2 }, 'able.baker':{ $regex:/\d/ } },
                { able:[ { able:1, baker:'foo' }, { able:5, baker:'123' } ]},
                { $inc:{ 'able.$.able':5 }},
                done
            );
        });
        it ("throws an Error when using $rename", function (done) {
            testUpdate (
                { 'able.able':2 },
                { able:[ { able:1 }, { able:2 } ]},
                { $rename:{ 'able.$.able':'chez' }},
                done
            );
        });
    });
});

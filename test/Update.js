
var async = require ('async');
var tools = require ('./common/tools');
var fauxmongo = require ('../fauxmongo');
var assert = require ('assert');
var testUpdate = tools.testUpdate;

before (tools.start);

describe ("#update", function(){
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
            assert (testDoc.able instanceof Date, 'set date to key');
            assert (testDoc.baker instanceof Date, 'set date to key');
            assert (testDoc.charlie.able instanceof Date, 'set date to key');
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
                        [ 9 ],
                        7,
                        [ 2 ],
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
        it ("performs an update at the position of an $elemMatch query", function (done) {
            testUpdate (
                { able:{ $elemMatch:{ baker:'123' }}},
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

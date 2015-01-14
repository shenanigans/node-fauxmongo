
var async = require ('async');
var tools = require ('./common/tools');
var fauxmongo = require ('../fauxmongo');
var assert = require ('assert');
var testQuery = tools.testQuery;

before (tools.start);

describe ("#matchQuery", function(){
    describe ("simple values", function(){
        it ("selects by a single shallow path", function (done) {
            testQuery (
                { able:9, baker:'this', charlie:'that' },
                { baker:'this' },
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
        it ("excludes by a single deep path, with valid deep paths", function (done) {
            testQuery (
                { able:9, baker:{ charlie:{ able:{ able:7 }}, baker:99, able:{ able:72 }}},
                { 'baker.able.able':72, 'baker.charlie.able.able':"7" },
                done
            );
        });
        it ("selects by a simple Array member path", function (done) {
            testQuery (
                { able:[ { able:4 } ] },
                { 'able.able':4 },
                done
            );
        });
        it ("selects by a complex Array member path", function (done) {
            testQuery (
                { able:[ { able:[ { able:4 } ] } ] },
                { 'able.able.able':4 },
                done
            );
        });
        it ("selects Array elements by Number index", function (done) {
            testQuery (
                { able:[ 0, 1, 2, 3, 4 ] },
                { 'able.2':2 },
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
        // KEYWORD
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
            it ("selects with logical bonanza", function (done) {
                testQuery (
                    {
                        able:   [
                            { able:0 },
                            { able:1 },
                            { able:2 },
                            { able:4 },
                            { able:5 },
                            { able:6 },
                            { able:7 },
                            { able:8 },
                            { able:9 }
                        ],
                        baker:      'foobar',
                        charlie:    42
                    },
                    {
                        $and:   [
                            { 'able.able':3 },
                            { 'able.able':{ $gt:5, $lt:11 }},
                            { 'able.able':{ $mod:[ 7, 2 ] }}
                        ],
                        $or:    [
                            { 'able.able':72 },
                            { 'able.able':'foo' },
                            { 'able.baker':'cheese' },
                            { 'able.able':2 }
                        ],
                        $nor:   [
                            { 'able.able':14 },
                            { 'able.baker':7 }
                        ],
                        baker:      { $not:/\d/ },
                        charlie:    { $not:{ $gt:9000 }}
                    },
                    done
                );
            });
        });
    });
});

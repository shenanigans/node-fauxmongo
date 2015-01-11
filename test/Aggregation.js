
var assert = require ('assert');
var async = require ('async');
var tools = require ('tools');
var fauxmongo = require ('../fauxmongo');
var FauxmongoError = fauxmongo.FauxmongoError;
var assert = require ('assert');
var testAggregation = tools.testAggregation;
var testAggregationFailure = tools.testAggregationFailure;
var evaluate = require ('../lib/AggregationOperators').evaluate;

before (tools.start);

describe ("#aggregate", function(){

    describe ("expressions", function(){
        var context = { CURRENT:{
            three:      3,
            five:       5,
            ten:        10,
            fifteen:    15,
            twentyFive: 25,
            able:       42,
            ABLE:       '42',
            baker:      'forty-two',
            charlie:    {
                able:       42,
                baker:      'Forty-Two'
            },
            dog:        [
                {
                    able:   9,
                    baker:  1
                },
                { able:3 },
                2,
                { able:1 },
                {
                    able:   1,
                    baker:  9
                }
            ],
            easy:       [
                1,
                2,
                { able:3 },
                3,
                { able:4 },
                4,
                { able:4 },
                5,
                [ { able:1 } ]
            ],
            fox:        [ 2, 1, 0 ],
            george:     [
                1,
                2,
                { able:2 },
                { able:3 },
                { able:4 },
                4,
                { able:5 },
                [ { able:1 } ],
                [ { able:2 } ]
            ],
            hotel:      [ 0, 0, false, 0, false, 'ham sandwich', false ],
            indigo:     [ 0, 0, false, 0, false, 0, false ],
            jig:        [ 0, 0, false, 0, false, 0, false ],
            nillo:      null
        }};

        it ("dereferences document paths", function(){
            assert (evaluate ('$baker', context) === 'forty-two', 'dereferences simple path');
            assert (evaluate ('$charlie.able', context) === 42, 'dereferences deep path');
            assert (
                evaluate ('$charlie.zebra', context) === undefined,
                'returns undefined if not found'
            );
        });

        describe ("variables", function(){

            it ("assigns and reads variables with $let", function(){
                assert.equal (
                    evaluate ({ $let:{
                        vars:   { foo:'$able' },
                        in:     '$$foo'
                    }}, context),
                    42,
                    'assigns and reads system variable'
                );
            });

            it ("assigns and reads variables with $map", function(){
                assert.deepEqual (
                    evaluate ({ $map:{
                        input:  '$fox',
                        as:     'foo',
                        in:     { foo:'$$foo' }
                    }}, context),
                    [ { foo:2 }, { foo:1 }, { foo:0 } ],
                    'assigns and reads system variable with $map'
                );
            });

        });

        describe ("literals", function(){

            it ("correctly evaluates literal objects", function(){
                assert.equal (evaluate (42, context), 42, 'number literal');
                assert.equal (evaluate ('twenty', context), 'twenty', 'string literal');
                assert.deepEqual (
                    evaluate ({
                        able:       42,
                        baker:      'forty-two',
                        charlie:    [
                            { foo:9 },
                            { foo:8 }
                        ]
                    }, context),
                    {
                        able:       42,
                        baker:      'forty-two',
                        charlie:    [
                            { foo:9 },
                            { foo:8 }
                        ]
                    },
                    'complex literal document'
                );
            });

            it ("honors $literal", function(){
                assert.equal (
                    evaluate ({ $literal:'forty-two' }, context),
                    'forty-two',
                    '$literal processing'
                );
            });

        });

        describe ("set operators", function(){

            describe ("$allElementsTrue", function(){

                it ("evaluates `true` when all elements are true or 1", function(){
                    assert.equal (
                        evaluate ({ $allElementsTrue:[ '$george' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("evaluates `false` when any element is not true or 1", function(){
                    assert.equal (
                        evaluate ({ $allElementsTrue:[ '$fox' ] }, context),
                        false,
                        'negative case'
                    );
                });

            });

            describe ("$anyElementTrue", function(){

                it ("evaluates `true` when any element is true or 1", function(){
                    assert.equal (
                        evaluate ({ $anyElementTrue:[ '$hotel' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("evaluates `false` when no element is true or 1", function(){
                    assert.equal (
                        evaluate ({ $anyElementTrue:[ '$indigo' ] }, context),
                        false,
                        'negative case'
                    );
                });

            });

            function matchSets (able, baker) {
                if (able.length != baker.length)
                    return false;
                for (var i in able) {
                    var found = false;
                    for (var j in baker)
                        if (fauxmongo.matchQuery.matchLeaves (able[i], baker[j])) {
                            found = true;
                            break;
                        }
                    if (!found)
                        return false;
                }
                return true;
            }

            describe ("$setDifference", function(){

                it ("removes one set from another", function(){
                    assert (
                        matchSets (
                            evaluate ({ $setDifference:[ '$easy', '$george' ] }, context),
                            [ 3, 5 ]
                        ),
                        'incorrect set selected'
                    );
                });

            });

            describe ("$setEquals", function(){

                it ("compares two matching sets", function(){
                    assert.equal (
                        evaluate ({ $setEquals:[ '$indigo', '$jig' ] }, context),
                        true,
                        'incorrect set selected'
                    );
                });

            });

            describe ("$setIntersection", function(){

                it ("intersects multiple sets together", function(){
                    assert (
                        matchSets (
                            evaluate ({ $setIntersection:[ '$dog', '$easy', '$george' ] }, context),
                            [ { able:3 }, 2 ]
                        ),
                        'incorrect set selected'
                    );
                });

            });

            describe ("$setIsSubset", function(){

                it ("confirms that a set is a subset of another", function(){
                    assert.equal (
                        evaluate ({ $setIsSubset:[ '$indigo', '$hotel' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("confirms that a set is not a subset of another", function(){
                    assert.equal (
                        evaluate ({ $setIsSubset:[ '$hotel', '$indigo' ] }, context),
                        false,
                        'negative case'
                    );
                });

            });

            describe ("$setUnion", function(){

                it ("unions multiple sets together", function(){
                    assert (
                        matchSets (
                            evaluate ({ $setUnion:[ '$dog', '$easy', '$george' ] }, context),
                            [
                                1, 2, 3, 4, 5,
                                { able:1 }, { able:2 }, { able:3 }, { able:4 }, { able:5 },
                                [ { able:1 } ], [ { able:2 } ],
                                { able:1, baker:9 }, { able:9, baker:1 }
                            ]
                        ),
                        'incorrect set selected'
                    );
                });

            });

            describe ("$size", function(){

                it ("evaluates to the length of an Array", function(){
                    assert.equal (
                        evaluate ({ $size:'$easy' }, context),
                        9,
                        'Array length'
                    );
                });

            });

        });

        describe ("comparators", function(){

            describe ("$cmp", function(){

                it ("picks the higher of two values", function(){
                    assert.equal (
                        evaluate ({ $cmp:[ '$five', '$ten' ] }, context),
                        -1,
                        'picked correctly'
                    );
                });

                it ("picks the higher of two mixed-type values", function(){
                    assert.equal (
                        evaluate ({ $cmp:[ '$able', '$ABLE' ] }, context),
                        -1,
                        'picked correctly'
                    );
                });

            });

            describe ("$eq", function(){

                it ("selects two equal expressions", function(){
                    assert.equal (
                        evaluate ({ $eq:[ '$able', '$charlie.able' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("rejects two inequal expressions", function(){
                    assert.equal (
                        evaluate ({ $eq:[ '$ABLE', '$charlie.able' ] }, context),
                        false,
                        'negative case'
                    );
                });

            });

            describe ("$(g|l)t(e)", function(){

                it ("selects with $gt", function(){
                    assert.equal (
                        evaluate ({ $gt:[ '$ten', '$five' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("rejects with $gt", function(){
                    assert.equal (
                        evaluate ({ $gt:[ '$ten', '$ten' ] }, context),
                        false,
                        'negative case'
                    );
                });

                it ("selects with $gte", function(){
                    assert.equal (
                        evaluate ({ $gte:[ '$ten', '$ten' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("selects with $lt", function(){
                    assert.equal (
                        evaluate ({ $lt:[ '$five', '$ten' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("rejects with $lt", function(){
                    assert.equal (
                        evaluate ({ $lt:[ '$ten', '$ten' ] }, context),
                        false,
                        'negative case'
                    );
                });

                it ("selects with $lte", function(){
                    assert.equal (
                        evaluate ({ $lte:[ '$ten', '$ten' ] }, context),
                        true,
                        'positive case'
                    );
                });

            });

            describe ("$ne", function(){

                it ("selects two inequal expressions", function(){
                    assert.equal (
                        evaluate ({ $cmp:[ '$ABLE', '$charlie.able' ] }, context),
                        true,
                        'positive case'
                    );
                });

                it ("rejects two equal expressions", function(){
                    assert.equal (
                        evaluate ({ $cmp:[ '$able', '$charlie.able' ] }, context),
                        false,
                        'negative case'
                    );
                });

            });

        });

        describe ("arithmetic operators", function(){

            describe ("$add", function(){

                it ("adds values", function(){
                    assert.equal (
                        evaluate ({ $add:[ '$five', '$three' ] }, context),
                        8,
                        'correct value'
                    )
                });

            });

            describe ("$divide", function(){

                it ("divides values", function(){
                    assert.equal (
                        evaluate ({ $divide:[ '$fifteen', '$three' ] }, context),
                        5,
                        'correct value'
                    )
                });

            });

            describe ("$mod", function(){

                it ("modulates values", function(){
                    assert.equal (
                        evaluate ({ $mod:[ '$twentyFive', '$ten' ] }, context),
                        5,
                        'correct value'
                    )
                });

            });

            describe ("$multiply", function(){

                it ("multiplies values", function(){
                    assert.equal (
                        evaluate ({ $multiply:[ '$five', '$three' ] }, context),
                        15,
                        'correct value'
                    )
                });

            });

            describe ("$subtract", function(){

                it ("subtracts values", function(){
                    assert.equal (
                        evaluate ({ $subtract:[ '$five', '$three' ] }, context),
                        2,
                        'correct value'
                    )
                });

            });

        });

        describe ("string operators", function(){

            describe ("$concat", function(){

                it ("concats strings", function(){
                    assert.equal (
                        evaluate ({ $concat:[ '$baker', '$charlie.baker' ] }, context),
                        'forty-twoForty-Two',
                        'correct value'
                    );
                });

            });

            describe ("$strcasecmp", function(){

                it ("compares two strings, ignoring case", function(){
                    assert.equal (
                        evaluate ({ $strcasecmp:[ '$baker', '$charlie.baker' ] }, context),
                        0,
                        'case insensitivity'
                    );
                });

            });

            describe ("$substr", function(){

                it ("reserves a substring", function(){
                    assert.equal (
                        evaluate ({ $substr:[ '$baker', 1, 5 ] }, context),
                        'orty-',
                        'substring selection'
                    );
                });

                it ("reserves an unterminated substring", function(){
                    assert.equal (
                        evaluate ({ $substr:[ '$baker', 6, -5 ] }, context),
                        'two',
                        'substring selection'
                    );
                });

            });

            describe ("$toLower", function(){

                it ("converts to lowercase", function(){
                    assert.equal (
                        evaluate ({ $toLower:'$charlie.baker' }, context),
                        'forty-two',
                        'case'
                    );
                });

            });

            describe ("$toUpper", function(){

                it ("converts to uppercase", function(){
                    assert.equal (
                        evaluate ({ $toUpper:'$baker' }, context),
                        'FORTY-TWO',
                        'case'
                    );
                });

            });

        });

        describe ("date operators", function(){

            var testDate = new Date (1420960891350);

            describe ("$dayOfMonth", function(){

                it ('retrieves day of the month from a date', function(){
                    assert.equal (
                        evaluate ({ $dayOfMonth:testDate }, context),
                        10,
                        'correct day'
                    );
                });

            });

            describe ("$dayOfWeek", function(){

                it ('retrieves day of the week from a date', function(){
                    assert.equal (
                        evaluate ({ $dayOfWeek:testDate }, context),
                        7,
                        'correct day'
                    );
                });

            });

            describe ("$dayOfYear", function(){

                it ('retrieves day of the month from a date', function(){
                    assert.equal (
                        evaluate ({ $dayOfYear:testDate }, context),
                        10,
                        'correct day'
                    );
                });

            });

            describe ("$hour", function(){

                it ('retrieves hour from a date', function(){
                    assert.equal (
                        evaluate ({ $hour:testDate }, context),
                        23,
                        'correct hour'
                    );
                });

            });

            describe ("$millisecond", function(){

                it ('retrieves millisecond from a date', function(){
                    assert.equal (
                        evaluate ({ $millisecond:testDate }, context),
                        350,
                        'correct milliseconds'
                    );
                });

            });

            describe ("$minute", function(){

                it ('retrieves minute from a date', function(){
                    assert.equal (
                        evaluate ({ $minute:testDate }, context),
                        21,
                        'correct minutes'
                    );
                });

            });

            describe ("$month", function(){

                it ('retrieves month from a date', function(){
                    assert.equal (
                        evaluate ({ $month:testDate }, context),
                        1,
                        'correct month'
                    );
                });

            });

            describe ("$second", function(){

                it ('retrieves seconds from a date', function(){
                    assert.equal (
                        evaluate ({ $second:testDate }, context),
                        31,
                        'correct seconds'
                    );
                });

            });

            describe ("$week", function(){

                it ('retrieves week of year from a date', function(){
                    assert.equal (
                        evaluate ({ $week:testDate }, context),
                        1,
                        'correct week'
                    );
                });

            });

            describe ("$year", function(){

                it ('retrieves year from a date', function(){
                    assert.equal (
                        evaluate ({ $year:testDate }, context),
                        2015,
                        'correct year'
                    );
                });

            });

        });

        describe ("conditional expressions", function(){

            describe ("$cond", function(){

                it ('evaluates to "then" clause, with Array of arguments', function(){
                    assert.equal (
                        evaluate ({
                            $cond:      [ { $gt:[ '$ten', 7 ] }, "then", "else" ]
                        }, context),
                        'then',
                        'correct clause'
                    );
                });

                it ('evaluates to "else" clause, with Array of arguments', function(){
                    assert.equal (
                        evaluate ({
                            $cond:      [ { $gt:[ '$ten', 11 ] }, "then", "else" ]
                        }, context),
                        'else',
                        'correct clause'
                    );
                });

                it ('evaluates to "then" clause, with argument document', function(){
                    assert.equal (
                        evaluate ({
                            $cond:      {
                                'if':       { $gt:[ '$ten', 7 ] },
                                'then':     "then",
                                'else':     "else"
                            }
                        }, context),
                        'then',
                        'correct clause'
                    );
                });

                it ('evaluates to "else" clause, with argument document', function(){
                    assert.equal (
                        evaluate ({
                            $cond:      {
                                'if':       { $gt:[ '$ten', 11 ] },
                                'then':     "then",
                                'else':     "else"
                            }
                        }, context),
                        'else',
                        'correct clause'
                    );
                });

            });

            describe ("$ifNull", function(){

                it ("replaces null with an expression", function(){
                    assert.equal (
                        evaluate ({ $ifNull:[ '$nillo', '$ten' ] }, context),
                        10,
                        'positive case'
                    );
                });

                it ("does not replace non-null", function(){
                    assert.equal (
                        evaluate ({ $ifNull:[ '$fifteen', '$ten' ] }, context),
                        15,
                        'negative case'
                    );
                });

            });

        });

    });

    describe ("$geoNear", function(){

        it ("throws an Error indicating that $geoNear is not supported", function(){
            try {
                fauxmongo.aggregate ([
                    { able:9, baker:1 },
                    { able:8, baker:2 },
                    { able:7, baker:3 },
                    { able:6, baker:4 },
                    { able:5, baker:5 },
                    { able:4, baker:6 },
                    { able:3, baker:7 },
                    { able:2, baker:8 },
                    { able:1, baker:9 }
                ], [
                    {
                        $geoNear:       { any:'info' }
                    }
                ]);
            } catch (err) {
                if (!(err instanceof FauxmongoError) || err.code != 'SUPPORT')
                    throw err;
                return;
            }

            throw new Error ('fauxmongo did not throw an Error');
        });

    });

    describe ("$group", function(){

        it ("performs the $group stage operation", function (done) {
            testAggregation ([
                { able:{ baker:9 },         foo:4 },
                { able:{ baker:'niner' },   foo:1 },
                { able:{ baker:9 },         foo:2 },
                { able:{ baker:'niner' },   foo:1 },
                { able:{ baker:{ able:2 }}, foo:1 },
                { able:{ baker:8 },         foo:8 },
                { able:{ baker:7 },         foo:5 },
                { able:{ baker:'niner' },   foo:1 },
                { able:{ baker:9 },         foo:1 },
                { able:{ baker:{ able:1 }}, foo:3 },
                { able:{ baker:9 },         foo:9 },
                { able:{ baker:{ able:1 }}, foo:700 },
                { able:{ baker:7 },         foo:3 },
                { able:{ baker:9 },         foo:56 }
            ], [
                { $group:{
                    _id:        '$able.baker',
                    totalFoo:   { $sum:'$foo' }
                }}
            ], done);
        });

        describe ("accumulators", function(){

            describe ("$addToSet", function(){

                it ("accumulates a set of unique items", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:'one' },
                        { able:{ baker:{ able:2 }}, foo:'one' },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:'one' },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:7 },         foo:{ bar:9 } },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:{ bar:10 } },
                        { able:{ baker:7 },         foo:{ bar:9 } },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            fooSet:     { $addToSet:'$foo' }
                        }}
                    ], done, true);
                });

            });

            describe ("$avg", function(){

                it ("accumulates Numbers", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            averageFoo: { $avg:'$foo' }
                        }}
                    ], done);
                });

                it ("throws an Error for non-Numbers", function(){
                    testAggregationFailure ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:'five' },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            averageFoo: { $avg:'$foo' }
                        }}
                    ], {
                        code:   'FORMAT'
                    });
                });

            });

            describe ("$first", function(){

                it ("selects the first document", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $sort:{
                            'able.baker':   1,
                            foo:            -1
                        }},
                        { $group:{
                            _id:        '$able.baker',
                            firstFoo:   { $first:'$foo' }
                        }}
                    ], done);
                });

            });

            describe ("$last", function(){

                it ("selects the last document", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $sort:{
                            'able.baker':   1,
                            foo:            -1
                        }},
                        { $group:{
                            _id:        '$able.baker',
                            lastFoo:    { $last:'$foo' }
                        }}
                    ], done);
                });

            });

            describe ("$max", function(){

                it ("selects the highest value", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            biggestFoo: { $max:'$foo' }
                        }}
                    ], done);
                });

            });

            describe ("$min", function(){

                it ("selects the highest value", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            lilestFoo:  { $min:'$foo' }
                        }}
                    ], done);
                });

            });

            describe ("$push", function(){

                it ("creates arrays of values", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            fooRoster:  { $push:{ foo:'$foo', fooParentID:'$able.baker' } }
                        }}
                    ], done);
                });

            });

            describe ("$sum", function(){

                it ("accumulates Numbers", function (done) {
                    testAggregation ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:5 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            sumFoo:     { $sum:'$foo' }
                        }}
                    ], done);
                });

                it ("throws an Error for non-Numbers", function(){
                    testAggregationFailure ([
                        { able:{ baker:9 },         foo:4 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:2 },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:{ able:2 }}, foo:1 },
                        { able:{ baker:8 },         foo:8 },
                        { able:{ baker:7 },         foo:'five' },
                        { able:{ baker:'niner' },   foo:1 },
                        { able:{ baker:9 },         foo:1 },
                        { able:{ baker:{ able:1 }}, foo:3 },
                        { able:{ baker:9 },         foo:9 },
                        { able:{ baker:{ able:1 }}, foo:700 },
                        { able:{ baker:7 },         foo:3 },
                        { able:{ baker:9 },         foo:56 }
                    ], [
                        { $group:{
                            _id:        '$able.baker',
                            sumFoo:     { $sum:'$foo' }
                        }}
                    ], {
                        code:   'FORMAT'
                    });
                });

            });

        });

    });

    describe ("$limit", function(){

        it ("limits the number of input documents", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $limit:2 }
            ], done);
        });

    });

    describe ("$match", function(){

        it ("selectively passes documents with a query", function (done) {
            testAggregation ([
                { able:9, baker:1 },
                { able:8, baker:2 },
                { able:7, baker:3 },
                { able:6, baker:4 },
                { able:5, baker:5 },
                { able:4, baker:6 },
                { able:3, baker:7 },
                { able:2, baker:8 },
                { able:1, baker:9 }
            ], [
                {
                    $match:     {
                        able:   { $gt:2 },
                        baker:  { $gt:2 }
                    }
                }
            ], done);
        });

    });

    describe ("$out", function(){

        it ("ignores $out stages that appear at the end", function(){
            fauxmongo.aggregate ([
                { able:9, baker:1 },
                { able:8, baker:2 },
                { able:7, baker:3 },
                { able:6, baker:4 },
                { able:5, baker:5 },
                { able:4, baker:6 },
                { able:3, baker:7 },
                { able:2, baker:8 },
                { able:1, baker:9 }
            ], [
                {
                    $match:     {
                        able:   { $gt:2 },
                        baker:  { $gt:2 }
                    }
                },
                {
                    $out:       'colname'
                }
            ]);
        });

        it ("throws an error when $out stages are not at the end", function(){
            try {
                fauxmongo.aggregate ([
                    { able:9, baker:1 },
                    { able:8, baker:2 },
                    { able:7, baker:3 },
                    { able:6, baker:4 },
                    { able:5, baker:5 },
                    { able:4, baker:6 },
                    { able:3, baker:7 },
                    { able:2, baker:8 },
                    { able:1, baker:9 }
                ], [
                    {
                        $out:       'colname'
                    },
                    {
                        $match:     {
                            able:   { $gt:2 },
                            baker:  { $gt:2 }
                        }
                    }
                ]);
            } catch (err) {
                if (!(err instanceof FauxmongoError) || err.code != 'INVALID')
                    throw err;
                return;
            }

            throw new Error ('fauxmongo did not throw an Error');
        });

    });

    describe ("$project", function(){

        it ("projects records with dot notation", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $project: {
                    'able.baker':   1,
                    charlie:        true
                }}
            ], done);
        });

        it ("projects records with layered specifications", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $project: {
                    able:       {
                        baker:      1
                    },
                    charlie:    true
                }}
            ], done);
        });

        it ("projects records with novel dotted fields", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $project: {
                    'novel.field':  '$able.baker'
                }}
            ], done);
        });

        it ("projects records with novel layered fields", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $project: {
                    novel:      {
                        field:      '$able.baker'
                    }
                }}
            ], done);
        });

    });

    describe ("$redact", function(){

        it ("redacts entire documents", function (done) {
            testAggregation ([
                { able:{ baker:[ 'a', 'b' ] } },
                { able:{ baker:[ 'b', 'c' ] } },
                { able:{ baker:[ 'c', 'd' ] } },
                { able:{ baker:[ 'd', 'b' ] } },
            ], [
                { $redact:{
                    $cond:{
                        if:         { $gt: [ { $size:{ $setIntersection:[
                            "$able.baker",
                            [ 'b' ]
                        ] } }, 0 ] },
                        then:       '$$KEEP',
                        'else':     '$$PRUNE'
                    }
                } }
            ], done);
        });

        it ("makes recursive redactions", function (done) {
            testAggregation ([
                { able:[ 'a', 'b' ], baker:[
                    { able:[ 'a', 'b' ] },
                    { able:[ 'b', 'c' ] },
                    { able:[ 'c', 'd' ] },
                    { able:[ 'd', 'b' ] }
                ] },
                { able:[ 'b', 'c' ], baker:[
                    { able:[ 'a', 'b' ] },
                    { able:[ 'b', 'c' ] },
                    { able:[ 'c', 'd' ] },
                    { able:[ 'd', 'b' ] }
                ] },
                { able:[ 'c', 'd' ], baker:[
                    { able:[ 'a', 'b' ] },
                    { able:[ 'b', 'c' ] },
                    { able:[ 'c', 'd' ] },
                    { able:[ 'd', 'b' ] }
                ] },
                { able:[ 'd', 'b' ], baker:[
                    { able:[ 'a', 'b' ] },
                    { able:[ 'b', 'c' ] },
                    { able:[ 'c', 'd' ] },
                    { able:[ 'd', 'b' ] }
                ] },
            ], [
                { $redact:{
                    $cond:{
                        if:         { $gt: [ { $size:{ $setIntersection:[
                            "$able",
                            [ 'b' ]
                        ] } }, 0 ] },
                        then:       '$$DESCEND',
                        'else':     '$$PRUNE'
                    }
                } }
            ], done);
        });

    });

    describe ("$skip", function(){

        it ("skips documents", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $skip:2 }
            ], done);
        });

    });

    describe ("$sort", function(){

        it ("sorts the input by the value of an expression", function (done) {
            testAggregation ([
                { able:{ baker:9 }, baker:42 },
                { able:{ baker:8 }, baker:42 },
                { able:{ baker:7 }, baker:42, charlie:9 },
                { able:{ baker:6 }, baker:42 },
            ], [
                { $sort:{
                    'able.baker':   1
                }}
            ], done);
        });

    });

    describe ("$unwind", function(){

        it ("unwinds documents by arrays of subdocuments", function (done) {
            testAggregation ([
                { able:{ baker:[ 0, 1, 2 ], charlie:9 }, foo:'ber' },
                { able:{ baker:[ 3, 4, 5 ], charlie:'niner' }, foo:'ma' },
                { able:{ baker:[ 6, 7, 8 ], charlie:'chaplin' }, foo:'shave' }
            ], [
                { $unwind:'$able.baker' }
            ], done);
        });

        it ("throws an Error when a non-Array is encountered", function(){
            try {
                fauxmongo.aggregate ([
                    { able:{ baker:[ 0, 1, 2 ], charlie:9 } },
                    { able:{ baker:"[ 3, 4, 5 ]", charlie:'niner' } },
                    { able:{ baker:[ 6, 7, 8 ], charlie:'chaplin' } }
                ], [
                    { $unwind:'$able.baker' }
                ]);
            } catch (err) {
                if (!(err instanceof fauxmongo.FauxmongoError) || err.code != 'FORMAT')
                    throw err;
                return;
            }

            throw new Error ('fauxmongo did not throw an Error');
        });

    });

});

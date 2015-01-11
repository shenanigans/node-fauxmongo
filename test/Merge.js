
var async = require ('async');
var tools = require ('tools');
var fauxmongo = require ('../fauxmongo');
var assert = require ('assert');
var testMerge = tools.testMerge;

before (tools.start);

describe ("#merge", function(){
    it ("performs a simple merge", function (done) {
        testMerge (
            {    // document
                able:       9001,
                baker:      'foo bar',
                charlie:    {
                    able:       'foo bar',
                    baker:      9001,
                    charlie:    {
                        able:       9001
                    }
                }
            },
            {    // query

            },
            {    // update
                $set:       {
                    able:                       1,
                    'charlie.baker':            42,
                    'charlie.charlie.able':     99
                }
            },
            {    // projection
                    able:                       1,
                    'charlie.baker':            1,
                    'charlie.charlie.able':     1
            },
            done
        );
    });

    it ("merges fields spread across Array elements", function (done) {
        testMerge (
            {    // document
                able:   [
                    { able:42, baker:99 },
                    { able:7,  baker:12 },
                    { able:42, baker:8  }
                ]
            },
            {    // query

            },
            {    // update
                $set:       {
                    'able.0.baker':     9001,
                    'able.1.baker':     9001,
                    'able.2.baker':     9001
                }
            },
            {    // projection
                'able.baker':       1
            },
            done
        );
    });

    it ("merges updated element to populated Array", function (done) {
        testMerge (
            {    // document
                able:   [
                    { able:42, baker:99 },
                    { able:7,  baker:12 },
                    { able:42, baker:8  }
                ]
            },
            {    // query
                'able.baker':   { $gt:80 }
            },
            {    // update
                $set:       {
                    'able.$.baker':     9001
                }
            },
            {    // projection
                'able.$':       1
            },
            done
        );
    });

    it ("merges updated element to populated Array with $elemMatch", function (done) {
        testMerge (
            {    // document
                able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
            },
            {    // query

            },
            {    // update
                $set:       {
                    'able.7':   9
                }
            },
            {    // projection
                able:   { $elemMatch:{ $gt:6 }}
            },
            done
        );
    });

    describe ("$slice", function(){
        it ("merges first elements into populated Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.1':   9,
                        'able.3':   9
                    }
                },
                {    // goal
                    able:[ 0, 9, 2, 9, 4, 5, 6, 7, 8, 9 ]
                },
                {    // projection
                    able:   { $slice:4 }
                },
                done
            );
        });

        it ("does not merge last elements into populated Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.7':   9,
                        'able.9':   10
                    }
                },
                {    // target
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // goal
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // projection
                    able:   { $slice:-4 }
                },
                done
            );
        });

        it ("merges middle elements into populated Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.4':   9,
                        'able.6':   9
                    }
                },
                {    // target
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // projection
                    able:   { $slice:[ 3, 4 ]}
                },
                done
            );
        });

        it ("drops elements from a populated Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $pop:   {
                        able:   1
                    }
                },
                {    // target
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // goal
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8 ]
                },
                {    // projection
                    able:   { $slice:[ 3, 10 ]}
                },
                done
            );
        });

        it ("merges first elements into empty Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.1':   9,
                        'able.3':   9,
                    }
                },
                {    // target
                    able:   [  ]
                },
                {    // goal
                    able:[ 0, 9, 2, 9 ]
                },
                {    // projection
                    able:   { $slice:4 }
                },
                done
            );
        });

        it ("does not merge last elements into empty Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.7':   9,
                        'able.9':   10
                    }
                },
                {    // target
                    able:   [  ]
                },
                {    // goal
                    able:[  ]
                },
                {    // projection
                    able:   { $slice:-4 }
                },
                done
            );
        });

        it ("merges middle elements into empty Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.4':   9,
                        'able.6':   9
                    }
                },
                {    // target
                    able:   [  ]
                },
                {    // goal
                    able:[
                        undefined, undefined, undefined, 3, 9, 5, 9
                    ]
                },
                {    // projection
                    able:   { $slice:[ 3, 4 ]}
                },
                done
            );
        });

        it ("merges first elements into missing Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.1':   9,
                        'able.3':   9,
                    }
                },
                {    // target

                },
                {    // goal
                    able:[ 0, 9, 2, 9 ]
                },
                {    // projection
                    able:   { $slice:4 }
                },
                done
            );
        });

        it ("does not merge last elements into missing Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.7':   9,
                        'able.9':   10
                    }
                },
                {    // target

                },
                {    // goal
                    able:[  ]
                },
                {    // projection
                    able:   { $slice:-4 }
                },
                done
            );
        });

        it ("merges middle elements into missing Array", function (done) {
            testMerge (
                {    // document
                    able:[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
                },
                {    // query

                },
                {    // update
                    $set:       {
                        'able.4':   9,
                        'able.6':   9
                    }
                },
                {    // target

                },
                {    // goal
                    able:[
                        undefined, undefined, undefined, 3, 9, 5, 9
                    ]
                },
                {    // projection
                    able:   { $slice:[ 3, 4 ]}
                },
                done
            );
        });
    });
});

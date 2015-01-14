
var async = require ('async');
var tools = require ('./common/tools');
var fauxmongo = require ('../fauxmongo');
var assert = require ('assert');
var testProject = tools.testProject;

before (tools.start);

describe ("#project", function(){
    it ("projects simple fields", function (done) {
        testProject (
            {    // document
                able:       'foo',
                baker:      'bar',
                charlie:    {
                    able:       'foo',
                    baker:      'bar',
                    charlie:    {
                        able:       'foo',
                        baker:      'bar',
                        charlie:    {
                            able:       'foo',
                            baker:      'bar',
                            charlie:    {
                                able:       'foo',
                                baker:      'bar'
                            }
                        }
                    }
                }
            },
            { }, // query
            {    // projection
                able:                                       1,
                'charlie.baker':                            1,
                'charlie.charlie.able':                     1,
                'charlie.charlie.charlie.baker':            1,
                'charlie.charlie.charlie.charlie.able':     1
            },
            done
        );
    });
    it ("projects Array elements", function (done) {
        testProject (
            {    // document
                able:   [
                    {
                        able:   'zero',
                        baker:  'three'
                    },
                    {
                        able:   'one',
                        baker:  'two'
                    },
                    {
                        able:   'two',
                        baker:  'one'
                    },
                    {
                        able:   'three',
                        baker:  'zero'
                    },
                ]
            },
            { }, // query
            {    // projection
                'able.able':    1
            },
            done
        );
    });
    it ("projects extra tricky Array elements", function (done) {
        testProject (
            { able:   [
                { able:   [
                    { able:     [
                        { able:     [
                            { able:     [
                                { able:     [
                                    { able: 'foo' }
                                ]}
                            ]}
                        ]},
                        { able:     [
                            { able:     [
                                { able:     [
                                    { able: 'foo' }
                                ]}
                            ]}
                        ]}
                    ]}
                ]},
                { able:   [
                    { able:     [
                        { able:     [
                            { able:     [
                                { able:     [
                                    { able: 'foo' }
                                ]}
                            ]}
                        ]},
                        { able:     [
                            { able:     [
                                { able:     [
                                    { able: 'foo' }
                                ]}
                            ]}
                        ]}
                    ]}
                ]}
            ]},
            { }, // query
            {    // projection
                // 'able':                                 1,
                // 'able.able':                            1,
                // 'able.able.able':                       1,
                // 'able.able.able.able':                  1,
                // 'able.able.able.able.able':             1,
                // 'able.able.able.able.able.able':        1,
                'able.able.able.able.able.able.baker':  1
            },
            done
        );
    });
    it ("partially projects missing simple fields", function (done) {
        testProject (
            {    // document
                able:   {
                    able:   {
                        able:   {
                            able:   {
                                yoke:   'foo'
                            }
                        }
                    },
                    baker:  {
                        able:   {
                            able:   {
                                yoke:   'foo'
                            }
                        }
                    }
                }
            },
            { }, // query
            {    // projection
                'able.baker.able.able.zebra':   1,
                'able.able.able.able.zebra':    1
            },
            done
        );
    });
    it ("projects (fully) with the positional operator", function (done) {
        testProject (
            {    // document
                able:   [
                    { able:0, baker:'able' },
                    { able:1, baker:'baker' },
                    { able:2, baker:'charlie' },
                    { able:3, baker:'dog' },
                    { able:4, baker:'easy' },
                    { able:5, baker:'fox' },
                    { able:6, baker:'george' },
                    { able:7, baker:'hotel' },
                ]
            },
            { 'able.able':5, 'able.baker':'dog' }, // query
            {    // projection
                'able.$.baker': 1
            },
            done
        );
    });
    it ("rejects projections with more than one positional argument", function(){
        try {
            fauxmongo.project (
                { able:[ 0,1,2,3,4,5,6,7,8,9 ], baker:[ 0,1,2,3,4,5,6,7,8,9 ]},
                { able:{ $gt:4 }, baker:{ $gt:6 }},
                { 'able.$': 1, 'baker.$':1 }
            );
            throw new Error (
                'should not have permitted projection with multiple positional arguments'
            );
        } catch (err) { /* meh */ }
    });
    it ("clobbers full parent field inclusion with positional projections", function (done) {
        testProject (
            {    // document
                able:   [
                    { able:0, baker:'able' },
                    { able:1, baker:'baker' },
                    { able:2, baker:'charlie' },
                    { able:3, baker:'dog' },
                    { able:4, baker:'easy' },
                    { able:5, baker:'fox' },
                    { able:6, baker:'george' },
                    { able:7, baker:'hotel' },
                ]
            },
            { 'able.able':5 }, // query
            {    // projection
                'able':     1,
                'able.$':   1
            },
            done
        );
    });
    it ("projects the correct element with the positional operator", function (done) {
        testProject (
            {    // document
                able:   [
                    { able:0, baker:'able' },
                    { able:1, baker:'baker' },
                    { able:2, baker:'charlie' },
                    { able:3, baker:'dog' },
                    { able:4, baker:'easy' },
                    { able:5, baker:'fox' },
                    { able:6, baker:'george' },
                    { able:7, baker:'hotel' },
                ]
            },
            { 'able.able':{ $gt:2, $lt:6 }, 'able.baker':'hotel' },
            { 'able.$': 1 },
            done
        );
    });
    it ("projects (fully) with the positional operator and an $elemMatch path query", function (done) {
        testProject (
            {    // document
                able:   [
                    { able:0, baker:'able' },
                    { able:1, baker:'baker' },
                    { able:2, baker:'charlie' },
                    { able:3, baker:'dog' },
                    { able:4, baker:'easy' },
                    { able:5, baker:'fox' },
                    { able:6, baker:'george' },
                    { able:7, baker:'hotel' },
                ]
            },
            { able:{ $elemMatch:{ able:{ $gt:4 }}}}, // query
            {    // projection
                'able.$.baker': 1
            },
            done
        );
    });
    it ("projects with the positional operator and an $elemMatch operator query", function (done) {
        testProject (
            {    // document
                able:   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
            },
            { able:{ $elemMatch:{ $gt:4 }}}, // query
            {    // projection
                'able.$':   1
            },
            done
        );
    });
    it ("fully projects elements with the positional operator", function (done) {
        testProject (
            {    // document
                able:   [
                    { able:0, baker:{
                        able:   'foo'
                    }},
                    { able:1, baker:{
                        able:   'foo'
                    }},
                    { able:2, baker:{
                        able:   'foo'
                    }},
                    { able:3, baker:{
                        able:   'foo'
                    }},
                    { able:4, baker:{
                        able:   'foo'
                    }},
                    { able:5, baker:{
                        able:   'foo'
                    }},
                    { able:6, baker:{
                        able:   'foo'
                    }},
                    { able:7, baker:{
                        able:   'foo'
                    }}
                ]
            },
            { able:{ $elemMatch:{ able:{ $gt:4 }}}}, // query
            {    // projection
                'able.$.baker.zebra':   1
            },
            done
        );
    });
    it ("projects with $slice", function (done) {
        testProject (
            {    // document
                able:   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
            },
            { }, // query
            {    // projection
                able:{ $slice:[ 2, 5 ]}
            },
            done
        );
    });
    it ("projects with $elemMatch path projection", function (done) {
        testProject (
            {    // document
                able:   [
                    { able:0, baker:{
                        able:   0
                    }},
                    { able:1, baker:{
                        able:   1
                    }},
                    { able:2, baker:{
                        able:   2
                    }},
                    { able:3, baker:{
                        able:   3
                    }},
                    { able:4, baker:{
                        able:   4
                    }},
                    { able:5, baker:{
                        able:   5
                    }},
                    { able:6, baker:{
                        able:   6
                    }},
                    { able:7, baker:{
                        able:   7
                    }},
                ]
            },
            { }, // query
            {    // projection
                'able':   { $elemMatch:{ 'baker.able': { $gt:4 }}}
            },
            done
        );
    });
    it ("projects with $elemMatch operator projection", function (done) {
        testProject (
            {    // document
                able:   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
            },
            { }, // query
            {    // projection
                'able':   { $elemMatch:{ $gt:4 }}
            },
            done
        );
    });
});

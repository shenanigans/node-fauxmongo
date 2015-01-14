
/**     @module fauxmongo
    Match MongoDB queries, apply updates and test aggregation pipelines on local documents.
@spare README
    This is the rendered output of the `fauxmongo` source documentation.
    *View the [source](https://github.com/shenanigans/node-fauxmongo) on GitHub!*
    @load
        ./README.md
*/

var getBSONType     = require ('./lib/GetBSONType');
var MatchQuery      = require ('./lib/MatchQuery');
var Update          = require ('./lib/Update');
var Merge           = require ('./lib/Merge');
var Project         = require ('./lib/Project');
var Aggregate       = require ('./lib/Aggregate');
var FauxmongoError  = require ('./lib/FauxmongoError');

module.exports.matchQuery = MatchQuery;
module.exports.update = Update;
module.exports.merge = Merge;
module.exports.project = Project;
module.exports.aggregate = Aggregate;
module.exports.FauxmongoError = FauxmongoError;

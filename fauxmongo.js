
/**     @module fauxmongo
    Applies updates and test queries on local javascript Objects instead of records on a far-away
    MongoDB instance. Works comfortably in both the Node.js and browser environments.
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

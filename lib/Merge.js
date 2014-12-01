
/**     @module/Function fauxmongo/lib/Merge

@argument/Object source
@argument/Object target
@argument/Object query
    @optional
@argument/Object projection
    @optional
*/

function merge (source, target, query, projection) {
    if (!projection) {
        projection = query;
        query = undefined;
    }

    if (!projection) {
        // merging with no projection is MUCH simpler

        return;
    }

    // projected merge

}

module.exports = merge;

fauxmongo
=========
Apply MongoDB updates to local documents.

Because it was necessary to support the `$` positional operator, the `$sort` keyword, and critically
the `$pull` operator, query testing is also supported for most of the MongoDB query specification.


Installation and Use
--------------------
```shell
$ npm install fauxmongo
```
```javascript
var fauxmongo = require ('fauxmongo');
fauxmongo.update (aDocument, anUpdate);
fauxmongo.update (aQuery, aDocument, anUpdate); // if you need the positional operator
var queryMatchesDoc = fauxmongo.matchQuery (aDocument, aQuery);
```


Tests
-----
The tests require a MongoDB instance to be accessible at the default host - `127.0.0.1:27017`. The
db/collection is `test-fauxmongo.test-fauxmongo` and all records created will be removed before the
tests finish.

The test method is "direct comparison" - the same document is transformed by `fauxmongo` and a real
database, then compared. This allows you to test `fauxmongo` with **your** database cluster before
using it in production.

```shell
$ npm test
```


Notes
-----
Imagine you have the rather confusing document `{ foo:[ { 1:"bar" }, "bar" ] }`. What is projected
if you call `find ({ "foo.1":"bar" }, { "foo.$":1 })`? The answer is `"bar"` but the question itself
has a huge implication. If you permit an Array to get nontrivially long and plan to query among its
members, you must **always** query on an indexed field and **never** use a numeric index in the
query document. If your query fails to select, your seemingly safe Number index is converted to a
String and the entire Array will be searched for an Object with a property of that name. To state
the problem in code, `{ "arr.21.score":{ $gt:0.5 }}` may instead perform the query
`{ arr:{ $elemMatch:{ "21.score":{ $gt:0.5 }}}}`.

Furthermore, note that `fauxmongo` has no choice but to scan for queries involving Arrays.

`$bit` uses the upsert behavior added in MongoDB version 2.5.3. If you're curious, MongoDB **does**
permit the use of up to three bitwise operands sequentially. In both MongoDB and `fauxmongo`, they
will be executed in document order.


Contrary to the MongoDB documentation, `$pull` **never** performs exact matches on Objects. Use
`$pullAll` instead.

The documented sorting behavior for mixed Numbers and Arrays, specifically that `[ 4 ]` and  `4` are
equal for purposes of `$sort`, is a lie. Neither MongoDB nor `fauxmongo` support this behavior.


Limitations
-----------
###Update Limitations
 * Ignores the `$setOnInsert` operator (because `fauxmongo` only understands updates, not insertion)
 * Does not support the deprecated operator `$pushAll`. Use `$push:{ $each:[ ...` instead.
 * `$currentDate` does not support the Timestamp date format. It just sets a `Date` to the path, period.

###Query Limitations
 * Does not support Geospatial Indexing.
 * Does not support text search.
 * Does not support `$where`.


LICENSE
-------
The MIT License (MIT)

Copyright (c) 2014 Kevin "Schmidty" Smith

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

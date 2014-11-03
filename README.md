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


Notes
-----
$bit uses the upsert behavior added in MongoDB version 2.5.3. If you're curious, MongoDB **does**
permit the use of up to three bitwise operands sequentially. In both MongoDB and `fauxmongo`, they
will be executed in document order.

$where only accepts Functions, not Strings.

Contrary to the MongoDB documentation, `$pull` **never** performs exact matches on Objects. Use
`$pullAll` instead.


Limitations
-----------
###Update Limitations
 * Ignores the `$setOnInsert` operator (because `fauxmongo` only understands updates, not insertion)
 * Does not support the deprecated operator `$pushAll`. Use `$push:{ $each:[ ...` instead.
 * `$currentDate` does not support the Timestamp date format. It just set a `Date` to the path, period.

###Query Limitations
 * Gimme a minute with the logical operators (`$and`, `$or`, `$not`, `$nor`).
 * Does not support Geospatial Indexing.
 * Does not support text search.
 * `$where` only accepts Function instances that address the document as `this`.


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

###Current test coverage
 * **queries** - 5%
 * **updates** - 100%


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

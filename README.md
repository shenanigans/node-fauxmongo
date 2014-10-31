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
require ('fauxmongo').update (aDocument, anUpdate);
```


Notes
-----
$bit uses the upsert behavior added in MongoDB version 2.5.3. If you're curious, MongoDB **does**
permit the use of up to three bitwise operands sequentially. In both MongoDB and fauxmongo, they
will be executed in document order.

$where only accepts Functions, not Strings.


Limitations
-----------
###Update Limitations
 * Ignores the `$setOnInsert` operator (because fauxmongo only understands updates, not insertion)
 * Does not support the deprecated operators `$pushAll` or `$pullAll`. Use `$each` instead.
 * `$currentDate` does not support the Timestamp date format. It ignores the update value entirely.
 * Does not support the `$rename` keyword, yet.

###Query Limitations
 * Gimme a minute with the logical operators (`$and`, `$or`, `$nor`).
 * Does not support Geospatial Indexing.
 * Does not support text search.
 * `$where` only accepts Function instances that address the document as `this`.


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


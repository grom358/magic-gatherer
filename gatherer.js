/**
 * This script is for fetching pages from gatherer.wizards.com for the sets
 * to import by the oracle script
 */

var sets = require('./sets.json'),
    request = require('./batch_request.js');

var downloads = [];
for (var setName in sets) {
    downloads.push({
        url: 'http://gatherer.wizards.com/Pages/Search/Default.aspx?output=spoiler&method=text&set=[%22' + encodeURIComponent(setName) + '%22]&special=true',
        filename: setName + '.html'
    });
}
request.batchDownload('sets', downloads, 5000);

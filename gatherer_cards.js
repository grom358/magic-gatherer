/**
 * This script is for fetching card pages from gatherer.wizards.com
 */

var cards = require('./dotp2012.json'),
    request = require('./batch_request.js');

var downloads = [];
cards.forEach(function(cardName) {
    downloads.push({
        url: 'http://gatherer.wizards.com/Pages/Card/Details.aspx?name=' + encodeURIComponent(cardName),
        filename: cardName + '.html'
    });
});
request.batchDownload('cards_test', downloads, 5000);

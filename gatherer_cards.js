/**
 * This script is for fetching card pages from gatherer.wizards.com
 */

var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    cards = require('./dotp2012.json');

var queue = []; // Queue of requests
var DELAY = 5000; // Delay between HTTP requests

if (!path.existsSync('cards')) {
    fs.mkdirSync('cards');
}

/*
 * For each card, queue up request
 */
cards.forEach(function(cardName) {
    var url = 'http://gatherer.wizards.com/Pages/Card/Details.aspx?name=' + encodeURIComponent(cardName);

    queue.push(function() {
        request({
            uri: url
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                fs.writeFile('./cards/' + cardName + '.html', body);
                console.log(cardName + " OK");
            } else {
                console.log(cardName + " FAIL");
            }
            // Schedule next task in queue
            setTimeout(runNext, DELAY);
        });
    });
});

/*
 * Callback for executing next request in queue
 */
function runNext() {
    if (queue.length) {
        var task = queue.shift();
        task();
    }
}

/*
 * Start executing the queue
 */
runNext();

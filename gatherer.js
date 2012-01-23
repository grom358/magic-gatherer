/**
 * This script is for fetching pages from gatherer.wizards.com for the sets
 * to import by the oracle script
 */

var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    sets = require('./sets.json');

var queue = []; // Queue of requests
var DELAY = 5000; // Delay between HTTP requests

if (!path.existsSync('sets')) {
    fs.mkdirSync('sets');
}

/*
 * For each set, queue up request
 */
for (var setName in sets) {
    var url = 'http://gatherer.wizards.com/Pages/Search/Default.aspx?output=spoiler&method=text&set=[%22' + encodeURIComponent(setName) + '%22]&special=true';

    queue.push(function() {
        request({
            uri: url
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                fs.writeFile('./sets/' + setName + '.html', body);
                console.log(setName + " OK");
            } else {
                console.log(setName + " FAIL");
            }
            // Schedule next task in queue
            setTimeout(runNext, DELAY);
        });
    });
}

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

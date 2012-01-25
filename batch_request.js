var fs = require('fs'),
    path = require('path'),
    request = require('request');

/**
 * Download a list of URLs and save to a folder
 *
 * @param folderName The folder to save links to
 * @param downloads Array of objects that contain <i>url</i> and
 *              <i>filename</i> properties
 * @param delayms Delay in milliseconds between downloads
 * @param callback Callback that receives an array of links that didn't download
 */
exports.batchDownload = function (folderName, downloads, delayms, callback) {
    var queue = []; // Queue of requests
    var errors = [];

    if (!path.existsSync(folderName)) {
        fs.mkdirSync(folderName);
    }

    downloads.forEach(function(download) {
        var url = download.url;
        var filename = download.filename;

        queue.push(function() {
            request({
                uri: url
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    fs.writeFile(path.join(folderName, filename), body);
                } else {
                    errors.push(link);
                }
                // Schedule next task in queue
                setTimeout(runNext, delayms);
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
        } else if (callback) {
            callback(errors);
        }
    }

    /*
     * Start executing the queue
     */
    runNext();
};

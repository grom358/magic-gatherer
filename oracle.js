/**
 * Parse the oracle text from the pages downloaded by gatherer script
 */

var fs = require('fs'),
    path = require('path'),
    jsdom = require('jsdom'),
    oracleUtils = require('./oracle_util.js');

var jquery = fs.readFileSync('./jquery-1.7.1.min.js').toString();

fs.readdir('sets', function (err, files) {
    var i = files.length;
    files.forEach(function(filename) {
        var setName = path.basename(filename, '.html');
        fs.readFile('./sets/' + filename, 'utf8', function (err, data) {
            if (err) throw err;
            jsdom.env({
                html: data,
                src: [
                    jquery
                ],
                done: function(errors, window) {
                    var $ = window.$;
                    parseSet(setName, $);
                    i--;
                    if (i === 0) {
                        completed();
                    }
                }
            });
        });
    });
});

var cardDb = {};

var sets = require('./sets.json');

function parseSet(setName, $) {
    var setAbbr = sets[setName];
    var card = { sets: {} };
    $('div.textspoiler table tr').each(function() {
        var $tr = $(this);
        var $col1 = $tr.find('td:first');
        if ($col1.attr('colspan') === '2') {
            var lookupName = card.name.replace("Æ", "AE");
            if (! lookupName in cardDb) {
                // Merge in set information
                $.extend(cardDb[lookupName].sets, card.sets);
            } else {
                cardDb[lookupName] = card;
            }
            card = { sets: {} };
        } else {
            var $col2 = $tr.find('td:last');
            var label = $col1.text().trim();
            var text = $col2.text().trim().replace(/—/, '-');
            var simplified = text.replace(/\s{2,}/g,' ');
            if (label === "Name:") {
                card.name = simplified;
                var matches = $col2.find('a').attr('href').match(/multiverseid=(\d+)/);
                var multiverseId = parseInt(matches[1]);
                card.sets[setAbbr] = {
                    "id": [multiverseId]
                };
            } else if (label === "Cost:") {
                card.cost = text.replace(/\(/g, '{').replace(/\)/g, '}');
            } else if (label === "Type:") {
                card.typeline = simplified;
            } else if (label === "Pow/Tgh:") {
                var matches = text.match(/\((\d+|\*)\/(\d+|\*)\)/);
                if (matches !== null) {
                    var reNum = /\d+/;
                    card.power = reNum.test(matches[1]) ? parseInt(matches[1]) : matches[1];
                    card.toughness = reNum.test(matches[2]) ? parseInt(matches[2]) : matches[2];
                }
            } else if (label === "Rules Text:") {
                card.rules = text.split("\n");
            } else if (label === "Set/Rarity:") {
                var re = new RegExp(setName + " (Uncommon|Common|Rare|Mythic Rare|Land)");
                var matches = text.match(re);
                if (matches !== null) {
                    card.sets[setAbbr].rarity = matches[1];
                }
            } else if (label === "Loyalty:") {
                var matches = text.match(/\((\d+|\*)\)/);
                if (matches !== null) {
                    card.loyalty = matches[1];
                }
            } else {
                var fieldName = label.toLowerCase().substr(0, label.length - 1);
                card[fieldName] = text;
            }
        }
    });
}

function extend(obj, src) {
    for (var key in src) {
        obj[key] = src[key];
    }
}

function processCard(card) {
    parseColors();
    parseCost();
    extend(card, oracleUtils.parseTypes(card.typeline));
    extend(card, oracleUtils.parseRules(card.name, card.rules));

    function parseColors() {
        // Rule. 202.2
        var colors = oracleUtils.getColors(card.cost);
        if ("color" in card) {
            var colorNameToSymbol = {
                "Black": "B",
                "Blue": "U",
                "Green": "G",
                "Red": "R",
                "White": "W"
            };
            var color = colorNameToSymbol[card.color];
            delete card.color;
            colors[color] = true;
        }
        card.colors = Object.keys(colors);
        if (card.colors.length === 0) {
            delete card.colors;
        }
    }

    /**
     * Parse mana cost information
     */
    function parseCost() {
        card.cmc = 0;
        if (! "cost" in card) {
            return;
        }
        if (card.cost === '') {
            delete card.cost;
            return;
        }

        var cost = oracleUtils.normalizeCost(card.cost);
        card.costs = oracleUtils.parseCost(cost);
        card.cmc = oracleUtils.calculateConvertedManaCost(card.costs);
    }
}

function completed() {
    for (var name in cardDb) {
        processCard(cardDb[name]);
    }
    console.log(JSON.stringify(cardDb, null, 4));
}

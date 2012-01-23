/**
 * Parse the oracle text from the pages downloaded by gatherer script
 */

var fs = require('fs'),
    path = require('path'),
    jsdom = require('jsdom');

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
                card.cost = text;
            } else if (label === "Type:") {
                card.typeline = simplified;
            } else if (label === "Pow/Tgh:") {
                var matches = text.match(/\((\d+|\*)\/(\d+|\*)\)/);
                if (matches !== null) {
                    card.power = matches[1];
                    card.toughness = matches[2];
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

function processCard(card) {
    parseColors();
    parseCost();
    parseTypes();
    parseRules();

    function parseColors() {
        // Rule. 202.2
        var colors = {};
        ['W', 'U', 'B', 'R', 'G'].forEach(function(color) {
            if (card.cost.indexOf(color) !== -1) {
                colors[color] = true;
            }
        });
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
        // Rule 202.3
        // Calculate the CMC and translate costs into more machine friendly format
        card.cmc = 0;
        if (! "cost" in card) {
            return;
        }
        if (card.cost === '') {
            delete card.cost;
            return;
        }

        var costs = [];
        var generic = /\d+/;
        var pattern =/X|\d+|(B|G|R|U|W)|\(2\/(B|G|R|U|W)\)|\((B|G|R|U|W)\/(B|G|R|U|W)\)|\((B|G|R|U|W)\/P\)/g;
        var matches = card.cost.match(pattern);
        for (var i = 0, n = matches.length; i < n; ++i) {
            var segment = matches[i].replace(/\(|\)/g, '');
            if (generic.test(segment)) {
                var a = parseInt(segment);
                costs.push(a);
                card.cmc += a;
            } else if (segment.length === 1) {
                costs.push(segment);
                card.cmc++;
            } else if (segment.substr(0, 2) === '2/') {
                costs.push([2, segment.charAt(2)]);
                card.cmc += 2;
            } else { // Hybrid or Phyrexian
                costs.push([segment.charAt(0), segment.charAt(2)]);
                card.cmc++;
            }
        }
        card.costs = costs;
    }

    /**
     * Parse the types from the typeline
     */
    function parseTypes() {
        var parts = card.typeline.split('-');
        var primary = parts[0].trim().toLowerCase();

        // Card types. Rule 204.2a
        card.types = [];
        [
            "artifact", "creature", "enchantment", "instant", "land", "plane",
            "planeswalker", "scheme", "sorcery", "tribal", "vanguard"
        ].forEach(function(cardType) {
            if (primary.indexOf(cardType) !== -1) {
                card.types.push(cardType);
            }
        });

        var supertypes = [];
        [
            "basic", "legendary", "ongoing", "snow", "world"
        ].forEach(function(superType) {
            if (primary.indexOf(superType) !== -1) {
                supertypes.push(superType);
            }
        });
        if (supertypes.length > 0) {
            card.supertypes = supertypes;
        }

        if (parts.length > 1) {
            card.subtypes = parts[1].trim().toLowerCase().split(' ');
        }
    }

    /**
     * Parse out information from rules
     */
    function parseRules() {
        function startsWith(str, test) {
            return str.substr(0, test.length) === test;
        }

        var detectKeywords = [
            "deathtouch", "defender", "double strike", "first strike", "flash",
            "flying", "haste", "hexproof", "intimidate", "landfall",
            "plainswalk", "islandwalk", "swampwalk", "mountainwalk", "forestwalk", // landwalk
            "lifelink", "reach", "shroud", "trample", "vigilance",
            "battle cry", "flanking", "infect", "persist", "undying", "wither"
        ];

        var cardName = card.name;
        var keywordPattern = /^(\w+(?:\s\w+)?)/;
        card.rules.forEach(function(line) {
            line = line.trim();
            if (startsWith(line, cardName + " is unblockable.")) {
                card.unblockable = true;
            } else if (startsWith(line, cardName + " is indestructible.")) {
                card.indestructible = true;
            } else if (startsWith(line, cardName + " enters the battlefield tapped.")) {
                card.enterTapped = true;
            } else if (startsWith(line, "Annihilator")) {
                var matches = line.match(/^Annihilator (\d+)/);
                card.annihilator = parseInt(matches[1]);
            } else if (startsWith(line, "Bloodthirst")) {
                var matches = line.match(/^Bloodthirst (\d+)/);
                if (matches !== null) {
                    card.bloodthirst = parseInt(matches[1]);
                }
            } else {
                var parts = line.toLowerCase().split(",");
                parts.forEach(function(test) {
                    var matches = test.trim().match(keywordPattern);
                    if (matches !== null && detectKeywords.indexOf(matches[1]) !== -1) {
                        var keyword = matches[1].replace(' ', '');
                        card[keyword] = true;
                    }
                });
            }
        });
    }
}

function completed() {
    for (var name in cardDb) {
        processCard(cardDb[name]);
    }
    console.log(JSON.stringify(cardDb));
}

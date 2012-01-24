var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    jsdom  = require('jsdom');

var jquery = fs.readFileSync("./jquery-1.7.1.min.js").toString();

var cardDb = {};

fs.readdir('cards', function (err, files) {
    var i = files.length;
    files.forEach(function(filename) {
        var cardName = path.basename(filename, '.html');
        fs.readFile('./cards/' + filename, 'utf8', function (err, data) {
            if (err) throw err;
            jsdom.env({
                html: data,
                src: [
                    jquery
                ],
                done: function(errors, window) {
                    var $ = window.$;
                    var card = parseCard($);
                    cardDb[cardName] = card;

                    i--;
                    if (i === 0) {
                        completed();
                    }
                }
            });
        });
    });
});

function parseCard($) {
    var symbolLookup = {
        'Black': 'B',
        'Blue': 'U',
        'Green': 'G',
        'Red': 'R',
        'White': 'W',
        'Variable Colorless': 'X',
        'Tap': 'T',
        'Untap': 'Q'
    };

    var card = { sets: {} };
    card.name = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_nameRow div.value').text().trim();

    parseSetRarity(card,
        $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_currentSetSymbol a:first'), true);

    card.typeline = simiplify($('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_typeRow div.value').text().trim());
    $.extend(card, parseTypes(card.typeline));

    var cmc = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_cmcRow div.value').text().trim();
    if (cmc !== '') {
        card.cmc = parseInt(cmc);
    }

    var rules = [];
    $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_textRow div.cardtextbox').each(function() {
        // Extract costs from image and insert into rule text
        $(this).find('img').each(function() {
            var cost = parseCost(this.alt);
            if (util.isArray(cost)) {
                cost = cost.join('/');
            }
            $(this).html("{" + cost + "}");
        });

        var rule = simiplify($(this).text().trim());
        if (rule !== '') {
            rules.push(rule);
        }
    });
    if (rules.length > 0) {
        card.rules = rules;
        $.extend(card, parseRules(card.name, rules));
    }

    var $costs = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_manaRow div.value');
    if ($costs.children().length > 0) {
        card.costs = parseManaCost($costs);
        card.cost = flattenCost(card.costs);
    }

    if (card.cost) {
        var colors = getColors(card.cost);
        var color = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_colorIndicatorRow div.value').text().trim();
        if (color !== '') {
            colors[symbolLookup[color]] = true;
        }
        card.colors = Object.keys(colors);
    }

    var ptLabel = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_ptRow div.label').text().trim();
    var pt = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_ptRow div.value').text().trim();
    var reNum = /\d+/;
    if (ptLabel === 'P/T:' && pt !== '') {
        pt = pt.replace(/\s+/, '').split('/');
        card.power = reNum.test(pt[0]) ? parseInt(pt[0]) : pt[0];
        card.toughness = reNum.test(pt[1]) ? parseInt(pt[1]) : pt[1];
    } else if (pt !== '') {
        card.pt = pt;
    }

    // Other sets
    $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_otherSetsValue a').each(function() {
        parseSetRarity(card, $(this));
    });

    return card;

    function startsWith(str, test) {
        return str.substr(0, test.length) === test;
    }

    function simiplify(text) {
        return text.trim().replace(/\s{2,}/g,' ').replace("\u2014", "-");
    }

    /**
     * Parse out mana costs into array of costs
     */
    function parseManaCost($manaCost) {
        var costs = [];

        $manaCost.find('img').each(function() {
            costs.push(parseCost(this.alt));
        });

        return costs;
    }

    /**
     * Convert cost string into array of costs
     */
    function parseCost(cost) {
        if (startsWith(cost, "Phyrexian ")) {
            var colorName = cost.substr("Phyrexian ".length);
            return [symbolLookup[colorName], 'P'];
        } else if (/\d+/.test(cost)) {
            return parseInt(cost);
        } else {
            var matches = cost.match(/(\w+) or (\w+)/);
            if (matches !== null) {
                return [symbolLookup[matches[1]], symbolLookup[matches[2]]];
            } else {
                return symbolLookup[cost];
            }
        }
    }

    /**
     * Flatten cost array into string in shorthand format. Eg. 3UG
     */
    function flattenCost(costs) {
        var flatten = [];
        costs.forEach(function(cost) {
            if (util.isArray(cost)) {
                flatten.push('{' + cost.join('/') + '}');
            } else {
                flatten.push(cost);
            }
        });
        return flatten.join('');
    }

    /**
     * Get the colors from cost string in shorthand format
     */
    function getColors(cost) {
        // Rule. 202.2
        var colors = {};
        ['W', 'U', 'B', 'R', 'G'].forEach(function(color) {
            if (cost.indexOf(color) !== -1) {
                colors[color] = true;
            }
        });
        return colors;
    }

    /**
     * Parse the types from the typeline
     */
    function parseTypes(typeline) {
        var parts = typeline.split('-');
        var primary = parts[0].trim().toLowerCase();

        // Card types. Rule 204.2a
        var ret = {
            types: []
        };
        [
            "artifact", "creature", "enchantment", "instant", "land", "plane",
            "planeswalker", "scheme", "sorcery", "tribal", "vanguard"
        ].forEach(function(cardType) {
            if (primary.indexOf(cardType) !== -1) {
                ret.types.push(cardType);
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
            ret.supertypes = supertypes;
        }

        if (parts.length > 1) {
            ret.subtypes = parts[1].trim().toLowerCase().split(' ');
        }

        return ret;
    }

    function parseSetRarity(card, $link, primary) {
        var matches;
        primary = primary || false;
        matches = $link.attr('href').match(/multiverseid=(\d+)/);
        var multiverseId = parseInt(matches[1]);
        var $img = $link.find('img');
        matches = $img.attr('src').match(/set=(\w+)/);
        var setAbbr = matches[1];
        matches = $img.attr('alt').match(/(.*) \((.*)\)/);
        var setName = matches[1];
        var rarity = matches[2];

        if (primary) {
            card.multiverseId = multiverseId;
            card.set = setAbbr;
            card.rarity = rarity;
        }

        if (setAbbr in card.sets) {
            if (card.sets[setAbbr].id.indexOf(multiverseId) === -1) {
                card.sets[setAbbr].id.push(multiverseId);
            }
        } else {
            card.sets[setAbbr] = {
                "id": [ multiverseId ],
                "rarity": rarity
            };
        }
    }

    /**
     * Parse out information from rules
     */
    function parseRules(cardName, lines) {
        var detectKeywords = [
            "deathtouch", "defender", "double strike", "first strike", "flash",
            "flying", "haste", "hexproof", "intimidate", "landfall",
            "plainswalk", "islandwalk", "swampwalk", "mountainwalk", "forestwalk", // landwalk
            "lifelink", "reach", "shroud", "trample", "vigilance",
            "battle cry", "flanking", "infect", "persist", "undying", "wither"
        ];

        var keywords = {};
        var keywordPattern = /^(\w+(?:\s\w+)?)/;
        lines.forEach(function(line) {
            line = line.trim();
            if (startsWith(line, cardName + " is unblockable.")) {
                keywords.unblockable = true;
            } else if (startsWith(line, cardName + " is indestructible.")) {
                keywords.indestructible = true;
            } else if (startsWith(line, cardName + " enters the battlefield tapped.")) {
                keywords.enterTapped = true;
            } else if (startsWith(line, "Annihilator")) {
                var matches = line.match(/^Annihilator (\d+)/);
                keywords.annihilator = parseInt(matches[1]);
            } else if (startsWith(line, "Bloodthirst")) {
                var matches = line.match(/^Bloodthirst (\d+)/);
                if (matches !== null) {
                    keywords.bloodthirst = parseInt(matches[1]);
                }
            } else {
                var parts = line.toLowerCase().split(",");
                parts.forEach(function(test) {
                    var matches = test.trim().match(keywordPattern);
                    if (matches !== null && detectKeywords.indexOf(matches[1]) !== -1) {
                        var keyword = matches[1].replace(' ', '');
                        keywords[keyword] = true;
                    }
                });
            }
        });

        return keywords;
    }
}

function completed() {
    console.log(JSON.stringify(cardDb, null, 4));
}

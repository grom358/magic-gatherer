var util = require('util');

var CARD_TYPES = [
    "artifact", "creature", "enchantment", "instant", "land", "plane",
    "planeswalker", "scheme", "sorcery", "tribal", "vanguard"
];

var CARD_SUPER_TYPES = ["basic", "legendary", "ongoing", "snow", "world"];

/**
 * Parse the types from the typeline
 */
exports.parseTypes = function(typeline) {
    var parts = typeline.split('-');
    var primary = parts[0].trim().toLowerCase();

    // Card types. Rule 204.2a
    var ret = {
        types: []
    };
    CARD_TYPES.forEach(function(cardType) {
        if (primary.indexOf(cardType) !== -1) {
            ret.types.push(cardType);
        }
    });

    var supertypes = [];
    CARD_SUPER_TYPES.forEach(function(superType) {
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
};

function startsWith(str, test) {
    return str.substr(0, test.length) === test;
}

var KEYWORDS = [
    "deathtouch", "defender", "double strike", "first strike", "flash",
    "flying", "haste", "hexproof", "intimidate", "landfall",
    "plainswalk", "islandwalk", "swampwalk", "mountainwalk", "forestwalk", // landwalk
    "lifelink", "reach", "shroud", "trample", "vigilance",
    "battle cry", "flanking", "infect", "persist", "undying", "wither",
    "totem armor"
];

/**
 * Parse out information from rules
 */
exports.parseRules = function(cardName, lines) {
    var data = {};
    var keywordPattern = /^(\w+(?:\s\w+)?)/;
    lines.forEach(function(line) {
        line = line.trim();
        if (startsWith(line, cardName + " is unblockable.")) {
            data.unblockable = true;
        } else if (startsWith(line, cardName + " is indestructible.")) {
            data.indestructible = true;
        } else if (startsWith(line, cardName + " enters the battlefield tapped.")) {
            data.enterTapped = true;
        } else if (startsWith(line, "Annihilator")) {
            var matches = line.match(/^Annihilator (\d+)/);
            data.annihilator = parseInt(matches[1]);
        } else if (startsWith(line, "Bloodthirst")) {
            var matches = line.match(/^Bloodthirst (\d+)/);
            if (matches !== null) {
                data.bloodthirst = parseInt(matches[1]);
            }
        } else if (startsWith(line, "Equip ")) {
            var matches = line.match(/^Equip (\S+)/);
            data.equip = parseCost(matches[1]);
        } else if (startsWith(line, "Kicker ")) {
            var matches = line.match(/^Kicker (\S+)/);
            data.kicker = parseCost(matches[1]);
        } else if (startsWith(line, "Multikicker ")) {
            var matches = line.match(/^Multikicker (\S+)/);
            data.multikicker = parseCost(matches[1]);
        } else {
            var parts = line.toLowerCase().split(",");
            parts.forEach(function(test) {
                var matches = test.trim().match(keywordPattern);
                if (matches !== null && KEYWORDS.indexOf(matches[1]) !== -1) {
                    var keyword = matches[1].replace(' ', '');
                    data[keyword] = true;
                }
            });
        }
    });

    return data;
};

/**
 * Flatten cost array into string in shorthand format. Eg. 3UG
 */
exports.flattenCost = function(costs) {
    var flatten = [];
    costs.forEach(function(cost) {
        if (util.isArray(cost)) {
            flatten.push('{' + cost.join('/') + '}');
        } else {
            flatten.push(cost);
        }
    });
    return flatten.join('');
};

/**
 * Get the colors from cost string in shorthand format
 */
exports.getColors = function(cost) {
    // Rule. 202.2
    var colors = {};
    ['W', 'U', 'B', 'R', 'G'].forEach(function(color) {
        if (cost.indexOf(color) !== -1) {
            colors[color] = true;
        }
    });
    return colors;
};

var SYMBOL_TABLE = {
    'Black': 'B',
    'Blue': 'U',
    'Green': 'G',
    'Red': 'R',
    'White': 'W',
    'Variable Colorless': 'X',
    'Two': 2,
    'Tap': 'T',
    'Untap': 'Q'
};

/**
 * Parse cost string in long format, ie. Green or Blue
 */
exports.parseCostWords = function(cost) {
    if (startsWith(cost, "Phyrexian ")) {
        var colorName = cost.substr("Phyrexian ".length);
        return [SYMBOL_TABLE[colorName], 'P'];
    } else if (/\d+/.test(cost)) {
        return parseInt(cost);
    } else {
        var matches = cost.match(/(\w+) or (\w+)/);
        if (matches !== null) {
            return [SYMBOL_TABLE[matches[1]], SYMBOL_TABLE[matches[2]]];
        } else {
            return SYMBOL_TABLE[cost];
        }
    }
};

/**
 * Convert cost string (eg. 3G(B/R)(2/R)) into oracle format (eg. {3}{G}{B/R}{2/R})
 */
exports.normalizeCost = function(cost) {
    return cost.replace(/\(|\)|{|}/g, '').replace(/\w\/\w|\d+|\w/g, "{$&}");
};

/**
 * Parse cost string (eg. {3}{2/G}{B/G}) into cost array
 */
function parseCost(cost) {
    var costs = [];
    var matches = cost.match(/{([^}]+)}/g);
    if (matches !== null) {
        var reNum = /\d+/;
        matches.forEach(function(cost) {
            cost = cost.replace(/{|}/g, '');
            if (reNum.test(cost)) {
                costs.push(parseInt(cost));
            } else if (cost.length === 1) {
                costs.push(cost);
            } else {
                // Hybrid
                var parts = cost.split('/');
                if (parts[0] === '2') {
                    parts[0] = 2;
                }
                costs.push(parts);
            }
        });
    }
    return costs;
}
exports.parseCost = parseCost;

/**
 * Calculate the Converted Mana Cost for cost array
 */
exports.calculateConvertedManaCost = function(costs) {
    // Rule 202.3
    var cmc = 0;
    costs.forEach(function(cost) {
        if (util.isArray(cost)) {
            if (cost[0] === 2) {
                cmc += 2;
            } else {
                cmc++;
            }
        } else if (cost !== 'X') {
            cmc++;
        }
    });
    return cmc;
};

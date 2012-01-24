var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    jsdom  = require('jsdom'),
    oracleUtils = require('./oracle_util.js');

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
    var card = { sets: {} };
    card.name = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_nameRow div.value').text().trim();

    parseSetRarity(card,
        $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_currentSetSymbol a:first'), true);

    card.typeline = simiplify($('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_typeRow div.value').text().trim());
    $.extend(card, oracleUtils.parseTypes(card.typeline));

    card.cmc = 0;
    var cmc = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_cmcRow div.value').text().trim();
    if (cmc !== '') {
        card.cmc = parseInt(cmc);
    }

    var rules = [];
    $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_textRow div.cardtextbox').each(function() {
        // Extract costs from image and insert into rule text
        $(this).find('img').each(function() {
            var cost = oracleUtils.parseCostWords(this.alt);
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
        $.extend(card, oracleUtils.parseRules(card.name, rules));
    }

    var $costs = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_manaRow div.value');
    if ($costs.children().length > 0) {
        card.costs = parseManaCost($costs);
        card.cost = oracleUtils.flattenCost(card.costs);
    }

    if (card.cost) {
        var colors = oracleUtils.getColors(card.cost);
        var color = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_colorIndicatorRow div.value').text().trim();
        if (color !== '') {
            colors[oracleUtils.getSymbol(color)] = true;
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

    function simiplify(text) {
        return text.trim().replace(/\s{2,}/g,' ').replace("\u2014", "-");
    }

    /**
     * Parse out mana costs into array of costs
     */
    function parseManaCost($manaCost) {
        var costs = [];

        $manaCost.find('img').each(function() {
            costs.push(oracleUtils.parseCostWords(this.alt));
        });

        return costs;
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
}

function completed() {
    console.log(JSON.stringify(cardDb, null, 4));
}

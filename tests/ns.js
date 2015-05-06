var spaz = require('../');

var Sparql = spaz.Sparql;

Sparql.config({
	mode: 'global',
	alias: '$$',
});

console.log($$);
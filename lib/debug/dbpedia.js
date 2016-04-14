
import spaz from '../main/index';

let $$ = spaz({
	engine: {
		endpoint: 'http://dbpedia.org/sparql',
		http_methods: 'post',
	},
	prefixes: {
		rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
		rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
		geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
		owl: 'http://www.w3.org/2002/07/owl#',
		dbo: 'http://dbpedia.org/ontology/',
		dbr: 'http://dbpedia.org/resource/',
		dbp: 'http://dbpedia.org/property/',
	},
});

var state = 'dbr:California';
var triples = [
	['owl:Thing', '?p1', '?o1'],
	['?o1', '?p2', '?o2'],
	['?o2', '?p3', 'owl:Thing'],
]

let q = $$.select('?s')
	.from('hello')
	.where('?s ?p ?o');

debugger;
let qc = q.from.clear();

console.log(qry.toSparql());

qry.rows(function(a_res) {
		console.log(a_res);
	});

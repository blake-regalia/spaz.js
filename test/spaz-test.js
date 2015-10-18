'use strict';

const spaz = require('../src');

let $$ = new spaz();


describe('.from()', () => {

	let q = $$.build('select');

	it('supports choosing multiple default graphs', () => {
		q.from('a','b','c')
			.from().should.deepEqual(['a','b','c']);
	});

	it('clears graphs w/ empty array', () => {
		let h_graphs = q.from([]).from(true);
		h_graphs.default.should.be.empty();
		h_graphs.named.should.be.empty();
	});

	it('does not allow duplicate default/named graphs', () => {
		q.from([])
			.from('a','b',{
				default: ['b','c'],
				named: ['a','d','e']
			})
			.from(true).should.deepEqual({
				default: ['a','b','c'],
				named: ['a','d','e'],
			});
	});

	it('supports mono-string args in long form', () => {
		q.from([])
			.from('a','b',{
				default: 'c',
				named: 'a'
			})
			.from(true).should.deepEqual({
				default: ['a','b','c'],
				named: ['a'],
			});
	});

	it('overwrites both graphs w/ array', () => {
		q.from(['x'])
			.from(true).should.deepEqual({
				default: ['x'],
				named: [],
			});
	});

	it('overwrites default graphs only w/ empty array in value', () => {
		q.from([])
			.from({
				default: 'a',
				named: 'b',
			})
			.from({
				default: [],
			})
			.from(true).should.deepEqual({
				default: [],
				named: ['b'],
			});
	});

	it('overwrites named graphs only w/ empty array in value', () => {
		q.from([])
			.from({
				default: 'a',
				named: 'b',
			})
			.from({
				named: [],
			})
			.from(true).should.deepEqual({
				default: ['a'],
				named: [],
			});
	});
});


describe('.select()', () => {

	let q = $$.build('select');

	it('supports selecting multiple variables of mix/match prefixes', () => {
		q.select('a','?b','$c')
			.select().should.deepEqual(['?a', '?b', '?c']);
	});

	it('does not allow duplicate variables in list', () => {
		q.select('a','a','b','?b','$c','?c','c','$a')
			.select().should.deepEqual(['?a', '?b', '?c']);
	});

	it('resets variable list w/ * operator', () => {
		q.select('a','b','c')
			.select('*')
			.select().should.be.empty();
	});
	
	it('clears variables list w/ empty array', () => {
		q.select('a','b','c')
			.select([])
			.select().should.be.empty();
	});

	it('overwrites variables list w/ array', () => {
		q.select('a','b','c')
			.select(['d','e','f'])
			.select().should.deepEqual(['?d', '?e', '?f']);
	});

	it('allows expression mapping', () => {
		q.select([])
			.select({
				price: '?p * (1 - ?discount)',
				'?key': '?value',
			}, '?original as ?alias')
			.select(true).should.deepEqual([
				{variable: '?price', expression: '?p * (1 - ?discount)'},
				{variable: '?key', expression: '?value'},
				{variable: '?alias', expression: '?original'},
			])
	});
});



describe('.group/having/order()', () => {

	let q = $$.build('select');

	it('allows multiple arguments', () => {
		q.group('a','b','c')
			.group().should.deepEqual(['a', 'b', 'c']);
	});

	it('clears conditions list w/ empty array', () => {
		q.group([])
			.group().should.be.empty();
	});

	it('overwrites conditions list w/ array', () => {
		q.group('a','b','c')
			.group(['d','e']).group('f')
			.group().should.deepEqual(['d', 'e', 'f']);
	});

	it('distinguishes between each method', () => {
		q.having('x')
			.having().should.deepEqual(['x']);
	})

});



describe('basic query', () => {

	let q = $$.build('select')
		.prefix(': </>');

	it('supports nested basic graph pattern inputs', () => {
		q
			.where(
				'?a a :A',
				['?a',':b','?c'],
				['?d', {
					a: ':D',
					':e': '?f',
					':g': {
						':h': '?i',
						':j': {
							':k': '?l'
						}
					}
				}],
				['?m', ':n', {
					':o': '?p',
					':q': {
						':r': '?s',
					}
				}]
			).where().should.deepEqual([
			{ type: 'bgp',
				triples: [
					{ subject: '?a',
						predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
						object: '/A' },
					{ subject: '?a', predicate: '/b', object: '?c' },
					{ subject: '?d',
					predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
					object: '/D' },
					{ subject: '?d', predicate: '/e', object: '?f' },
					{ subject: '?d', predicate: '/g', object: '_:b0' },
					{ subject: '_:b0', predicate: '/h', object: '?i' },
					{ subject: '_:b0', predicate: '/j', object: '_:b1' },
					{ subject: '_:b1', predicate: '/k', object: '?l' },
					{ subject: '?m', predicate: '/n', object: '_:b2' },
					{ subject: '_:b2', predicate: '/o', object: '?p' },
					{ subject: '_:b2', predicate: '/q', object: '_:b3' },
					[ { subject: '_:b3', predicate: '/r', object: '?s' } ]
				]
			}]);
	});

	it('supports minus & optional blocks', () => {
		q.where.clear()
			.where(
				'?a :basic ?b',
				$$.minus(
					'?a :minus ?b'
				),
				$$.optional(
					'?a :optional ?b'
				)
			)
			.where().should.deepEqual([
			  { type: 'bgp',
			    triples: [ { subject: '?a', predicate: '/basic', object: '?b' } ] },
			  { type: 'minus',
			    patterns: 
			     [ { type: 'bgp',
			         triples: [ { subject: '?a', predicate: '/minus', object: '?b' } ] } ] },
			  { type: 'optional',
			    patterns: 
			     [ { type: 'bgp',
			         triples: [ { subject: '?a', predicate: '/optional', object: '?b' } ] } ] }
			  ]);
	});

});


describe('pattern builder', () => {

	let q = $$.build('select')
		.prefix(': </>');

	it('supports all pattern types', () => {
		q.where(
			$$.union(
				'?a :basic ?b',
				'?a :union ?b'
			),
			$$.minus(
				'?a :minus ?b'
			),
			$$.optional(
				'?a :optional ?b'
			)
			$$.exists(
				'?a :exists ?b'
			),
			$$.not.exists(
				'?a :not.exists ?b'
			)
		);
	});
});

describe('subselect', () => {

	let q = $$.build('select');

	it('works', () => {
		q.select('?y','?name')
			.where(
				['?x', 'foaf:knows', '?y'],
				$$.select('?y', 'sample(?name)')
					.where(
						['?x', 'foaf:name', '?name']
					)
					.order('?x')
					.group('?name')
			).serialize().should.equal(
				'select ?y ?name '
				+'where { ?x foaf:knows ?y . '
					+'{ select ?y sample(?name) '
						+'where { ?x foaf:name ?name . } '
						+'order by ?x '
						+'group by ?name '
					+'} '
				+'}'
			);

		// SELECT ?y ?name
		// WHERE {
		//   ?x foaf:knows ?y .
		//   {
		//     SELECT ?y SAMPLE(?name)
		//     WHERE {
		//       ?x foaf:name ?name . 
		//     }
		//     ORDER BY ?x
		//     GROUP BY ?name
		//   }
		// }
	});
});



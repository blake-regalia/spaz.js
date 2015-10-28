'use strict';

const spaz = require('../src');

let $$ = new spaz();

$$.prefixes.clear();


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



describe('pattern builder', () => {

	let q = $$.build('select')
		.prefix(': </>');

	it('supports nested basic graph pattern inputs', () => {
		q.where.clear().where(
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
			).sparql().should.equal('prefix :</>select*{?a<http://www.w3.org/1999/02/22-rdf-syntax-ns#type></A>.?a</b>?c.?d<http://www.w3.org/1999/02/22-rdf-syntax-ns#type></D>.?d</e>?f.?d</g> _:b0. _:b0</h>?i. _:b0</j> _:b1. _:b1</k>?l.?m</n> _:b2. _:b2</o>?p. _:b2</q> _:b3. _:b3</r>?s}');
	});

	it('supports group graph pattern types (union/minus/optional/exists/not.exists)', () => {
		q.where.clear().where(
			$$.union(
				'?a :basic ?b',
				'?a :union ?b'
			),
			$$.minus(
				'?a :minus ?b'
			),
			$$.optional(
				'?a :optional ?b'
			),
			$$.exists(
				'?a :exists ?b'
			),
			$$.not.exists(
				'?a :not.exists ?b'
			)
		).sparql().should.equal('prefix :</>select*{{?a</basic>?b}union{?a</union>?b}minus{?a</minus>?b}optional{?a</optional>?b}filterexists{?a</exists>?b}filternotexists{?a</not.exists>?b}}');
	});
});


describe('SPARQL parser', () => {

	let q;

	it('parses simple query', () => {
		$$('prefix : </> select ?a (?b*1 as ?c) from :default from named :named { ?a :ab ?b }')
			.sparql().should.equal('prefix :</>select?a?b*"1"^^<http://www.w3.org/2001/XMLSchema#integer>as?c from</default> from named</named>{?a</ab>?b}');
	});
});
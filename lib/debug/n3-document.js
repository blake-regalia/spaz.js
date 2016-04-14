
import spaz from '../main/index';

let $$ = spaz();

let s_ttl = $$.ttl(
	[':Orange', {
		a: 'ns:Fruit',
		'ns:like': ['plant:Tree', 'plant:Bush', 'plant:Thing'],
		'ns:Test': {
			a: ':Blanknode',
			works: $$.val('indeed'),
		},
	}]
).output();

console.log(s_ttl);

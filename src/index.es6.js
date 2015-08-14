// imports
import express    from 'express';
import bodyParser from 'body-parser';
//import './db.es6.js';
import './neo4j.es6.js';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Conceptual entities
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ENTITIES = [
	'lyphs',
	'layers',
	'lyphTemplates',
	'layerTemplates',
	'borders',
	'nodes',
	'processes',
	'correlations',
	'publications',
	'variables',
	'clinicalIndices',
	'locatedMeasures',
	'bagsOfPathology'
];

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MongoDB stuff
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// REST interface
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// the express application
let app = express();

// middleware
app.use(bodyParser.json());

// to implement an API for a specific type of entity (e.g., lyphs)
function implementEntity(name) {
	const jsonBody = req => JSON.stringify(req.body, null, '    ');
	app.get(`/${name}`, (req, res) => {
		res.send(`You requested the ${name} collection.`);
	});
	app.get(`/${name}/:id`, (req, res) => {
		res.send(`You requested ${name} '${req.params.id}'.`);
	});
	app.post(`/${name}`, (req, res) => {
		res.send(`You created a new ${name} with fields \n ${jsonBody(req)}.`);
	});
	app.post(`/${name}/:id`, (req, res) => {
		res.send(`You modified ${name} '${req.params.id}' with fields \n ${jsonBody(req)}.`);
	});
	app.put(`/${name}`, (req, res) => {
		res.send(`You created a new ${name} with full body \n ${jsonBody(req)}.`);
	});
	app.put(`/${name}/:id`, (req, res) => {
		res.send(`You replaced ${name} '${req.params.id}' with full body \n ${jsonBody(req)}.`);
	});
	app.delete(`/${name}/:id`, (req, res) => {
		res.send(`You deleted ${name} '${req.params.id}'.`);
	});
}


// Test stuff
ENTITIES.forEach(implementEntity);


// start listening on port 3000 (temporary)
let server = app.listen(3000);

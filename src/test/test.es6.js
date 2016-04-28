////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// imports                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import {template, isString, isFunction, isArray} from '../libs/lodash.es6.js';
import chai, {expect}                            from 'chai';

import supertest   from './custom-supertest.es6.js';
import getServer   from '../server.es6.js';
import swaggerSpec from '../swagger.es6.js';
import {resources} from '../resources.es6.js';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// chai helpers                                                                                                       //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

chai.use((_chai, utils) => {
	utils.addProperty(chai.Assertion.prototype, 'sole', function () {
		/* object must be an array */
		this.assert(
			Array.isArray(this._obj)
			, 'expected #{this} to be an array'
			, 'expected #{this} not to be an array'
		);
		/* set 'sole' flag */
		utils.flag(this, 'sole', true);
	});
	utils.addProperty(chai.Assertion.prototype, 'element', function () {
		/* object must be an array */
		this.assert(
			Array.isArray(this._obj)
			, 'expected #{this} to be an array'
			, 'expected #{this} not to be an array'
		);
		/* array must have at least one element */
		this.assert(
			this._obj.length >= 1
			, 'expected #{this} to have at least one element'
			, 'expected #{this} not to have at least one element'
		);
		/* if 'sole' is set, array must have exactly one element */
		let sole = utils.flag(this, 'sole');
		if (sole) {
			this.assert(
				this._obj.length === 1
				, 'expected #{this} to have exactly one element'
				, 'expected #{this} not to have exactly one element'
			);
		}
		utils.flag(this, 'object', this._obj[0]);
	});
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// setup                                                                                                              //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* before testing: start server, wait for it, get the supertest library rolling */
let api, db;
before(() => getServer(`${__dirname}/../`, {
	exposeDB: true,
	dbUser: 'neo4j',
	dbPass: 'mhmh13',
	dbHost: 'localhost',
	dbPort: 7474,
	consoleLogging: false
}).then(({database, server}) => {
	db  = database;
	api = supertest(Promise)(server);
}));


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// utility                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* database operations (bypassing our REST server */
const getAllResources   = async (typeName)         => await db.getAllResources(resources[typeName]);
const getResources      = async (typeName, ids)    => await db.getSpecificResources(resources[typeName], ids);
const getSingleResource = async (typeName, id)     => (await getResources(typeName, [id]))[0];
const refreshResource   = async (res)              => Object.assign(res, await getSingleResource(res.type, res.id));
const createResource    = async (typeName, fields) => await getSingleResource(typeName, await db.createResource(resources[typeName], fields));

/* server request api (through our REST server) */
const requestResources      = async (path) => (await api.get(path)).body;
const requestSingleResource = async (path) => (await requestResources(path))[0];

/* dynamically created, specialized functions and variables used in describing our tests */
let GET, POST, PUT, DELETE;
let type;
let setInvalidPathParams, setValidPathParams, withInvalidPathParams, withValidPathParams;
let describeEndpoint;

/* DESCRIBE BLOCK: given resource type */
const describeResourceType = (typeName, runResourceTypeTests) => {
	let only = (typeName[0] === '*');
	if (only) { typeName = typeName.slice(1) }
	(only ? describe.only : describe)(typeName, () => {

		/* set useful variables */
		before(() => { type = resources[typeName] });

		/* DESCRIBE BLOCK: given endpoint */
		describeEndpoint = (givenPath, supportedVerbs, runEndpointTests) => {
			describe(givenPath, () => {

				/* for setting the path parameters */
				let compiledPath = givenPath;
				let compilePath  = template(compiledPath, { interpolate: /{(\w+?)}/g });

				/* the verb testers */
				const verbTester = (verb) => (claim, expectations) => {
					it(`${verb.toUpperCase()} ${claim}`, () => expectations(api[verb](compiledPath)));
				};
				GET    = verbTester('get');
				POST   = verbTester('post');
				PUT    = verbTester('put');
				DELETE = verbTester('delete');
				let VERB = {GET, POST, PUT, DELETE};

				/* DESCRIBE BLOCK: given valid path parameters */
				withValidPathParams = (desc, params, runParamTests) => {
					if (!isString(desc)) { [desc, params, runParamTests] = ["valid", desc, params] }
					describe(`(${desc} path parameters)`, () => {
						beforeEach(() => { compiledPath = compilePath(isFunction(params) ? params() : params) });

						/* run tests common to all endpoints with valid path params */
						if (/^\/\w+\/{\w+}$/.test(givenPath)) {
							GET("returns an array with at least one resource of the expected type", r=>r
								.expect(200)
								.expect(isArray)
								.resources((resources) => {
									expect(resources).to.have.length.of.at.least(1);
									for (let res of resources) {
										expect(res).to.have.property('type', type.name);
									}
								})
							);
						}

						/* run given tests */
						if (runParamTests) { runParamTests() }
					});
				};

				/* DESCRIBE BLOCK: given invalid path parameters */
				withInvalidPathParams = (desc, params, runParamTests) => {
					if (!isString(desc)) { [desc, params, runParamTests] = ["invalid", desc, params] }
					describe(`(${desc} path parameters)`, () => {
						/* set the compiled path before each test */
						beforeEach(() => { compiledPath = compilePath(isFunction(params) ? params() : params) });

						/* run tests common to all endpoints with invalid path params  */
						if (/^\/\w+\/{\w+}$/.test(givenPath)) {
							for (let verb of supportedVerbs) {
								// TODO: to test this on POST and PUT, supply 'example' body from swagger
								if (verb !== 'POST' && verb !== 'PUT') {
									VERB[verb]("responds with a 404 error", r=>r.expect(404));
								}
							}
						}

						/* run given tests */
						if (runParamTests) { runParamTests() }
					});
				};

				/* run tests common to all endpoints */
				if (/^\/\w+$/.test(givenPath)) {
					GET("returns an array with resources of the expected type", r=>r
						.expect(200)
						.expect(isArray)
						.resources((resources) => {
							expect(resources).to.have.instanceOf(Array);
							for (let res of resources) {
								expect(res).to.have.property('type', type.name);
							}
						})
					);
				}

				/* run given tests */
				if (runEndpointTests) { runEndpointTests() }

			});
		};

		/* run given tests */
		if (runResourceTypeTests) { runResourceTypeTests() }

	});
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// before each test, reset the database                                                                               //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* variables to store all resources created at the beginning of each test */
let initial = {};

/* initial database clearing */
before(() => db.clear('Yes! Delete all everythings!'));

/* before each test, reset the database */
beforeEach(async () => {

	/* lyph template */
	initial.lyphTmp1 = await createResource('LyphTemplate', { name: "lyph template 1" });
	initial.lyphTmp2 = await createResource('LyphTemplate', { name: "lyph template 2" });

	/* lyphs */
	initial.lyph1 = await createResource('Lyph', { name: "lyph 1", species: "dragon", template: initial.lyphTmp1.id });

	/* layer templates (in sequential order, so their positions are predictable) */
	initial.layerTmp1 = await createResource('LayerTemplate', { lyphTemplate: initial.lyphTmp1.id, thickness: { min: 1, max: 2 } });
	initial.layerTmp2 = await createResource('LayerTemplate', { lyphTemplate: initial.lyphTmp1.id, thickness: { min: 2, max: 5 } });
	initial.layerTmp3 = await createResource('LayerTemplate', { lyphTemplate: initial.lyphTmp1.id, thickness: { min: 3, max: 9 } });

	/* layers */
	[   initial.layer1,
		initial.layer2,
		initial.layer3
	] = await getResources('Layer', [
		initial.layerTmp1.instantiations[0],
		initial.layerTmp2.instantiations[0],
		initial.layerTmp3.instantiations[0]
	]);
	//initial.layer1 = await getSingleResource('Layer', initial.layerTmp1.instantiations[0]);
	//initial.layer2 = await getSingleResource('Layer', initial.layerTmp2.instantiations[0]);
	//initial.layer3 = await getSingleResource('Layer', initial.layerTmp3.instantiations[0]);

	/* borders */
	initial.layer1plus  = await getSingleResource('Border', initial.layer1.plus);
	initial.layer1minus = await getSingleResource('Border', initial.layer1.minus);
	initial.layer1outer = await getSingleResource('Border', initial.layer1.outer);
	initial.layer1inner = await getSingleResource('Border', initial.layer1.inner);

	/* canonical tree */
	initial.cTree1 = await createResource('CanonicalTree', { name: "canonical tree 1" });

	/* canonical tree levels */
	initial.cTreeLevel1 = await createResource('CanonicalTreeLevel', { name: "canonical tree level 1", tree: initial.cTree1.id, template: initial.lyphTmp1.id });
	initial.cTreeLevel2 = await createResource('CanonicalTreeLevel', { name: "canonical tree level 2", tree: initial.cTree1.id, template: initial.lyphTmp1.id });
	initial.cTreeLevel3 = await createResource('CanonicalTreeLevel', { name: "canonical tree level 3", tree: initial.cTree1.id, template: initial.lyphTmp1.id });

	// TODO: add other stuff to the database (at least one instance of each resource type)

	/* refresh all resource objects */
	await Promise.all(Object.values(initial).map(refreshResource));

});

/* clear database for every tear-down */
afterEach(() => db.clear('Yes! Delete all everythings!'));


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// tests                                                                                                              //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describe("swagger.json", () => {

	it("is a JSON file available through the server", () => api
		.get('/swagger.json')
		.expect(200)
		.expect('Content-Type', /application\/json/)
		.expect(({body}) => { expect(body).to.deep.equal(swaggerSpec) }));

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describe("docs", () => {

	it("is an html page available through the server", () => api
		.get('/docs')
		.redirects(5)
		.expect(200)
		.expect('Content-Type', /text\/html/));

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('LyphTemplate', () => {

	describeEndpoint('/lyphTemplates',      ['GET', 'POST']);

	describeEndpoint('/lyphTemplates/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.layerTmp1.id }));

		withValidPathParams(()=>({ id: initial.lyphTmp1.id }), () => {

			GET("returns a resource with expected fields", r=>r.resource((res) => {
				expect(res).to.have.property('name'           ).that.equals("lyph template 1");
				expect(res).to.have.property('layers'         ).with.members([ initial.layerTmp1.id, initial.layerTmp2.id, initial.layerTmp3.id ]);
				expect(res).to.have.property('instantiations' ).with.members([ initial.lyph1.id ]);
				expect(res).to.have.property('materialIn'     ).that.is.instanceOf(Array); // TODO: make specific when appropriate
				expect(res).to.have.property('materialInLyphs').that.is.instanceOf(Array); // TODO: make specific when appropriate
				expect(res).to.have.property('materials'      ).that.is.instanceOf(Array); // TODO: make specific when appropriate
				expect(res).to.have.property('locatedMeasures').that.is.instanceOf(Array); // TODO: make specific when appropriate
			}));

		});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('LayerTemplate', () => {

	/* local utility function */
	async function requestLayerTemplatesAndLayers() {
		return await Promise.all([
			requestResources(`/layerTemplates/${initial.layerTmp1.id}`),
			requestResources(`/layerTemplates/${initial.layerTmp2.id}`),
			requestResources(`/layerTemplates/${initial.layerTmp3.id}`),
			requestResources(`/layers/${initial.layer1.id}`),
			requestResources(`/layers/${initial.layer2.id}`),
			requestResources(`/layers/${initial.layer3.id}`)
		]);
	}

	describeEndpoint('/layerTemplates',      ['GET', 'POST']);

	describeEndpoint('/layerTemplates/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));

		withValidPathParams(()=>({ id: initial.layerTmp1.id }), () => {

			GET("returns a resource with expected fields", r=>r.resource((res) => {
				expect(res).to.have.property('lyphTemplate'  ).that.equals(initial.lyphTmp1.id);
				expect(res).to.have.property('position'      ).that.equals(1);
				expect(res).to.have.property('instantiations').with.members([ initial.layer1.id ]);
				expect(res).to.have.property('materials'     ).that.is.instanceOf(Array); // TODO: make specific when appropriate
				expect(res).to.have.property('thickness'     ).that.deep.equals({ min: 1, max: 2 });
			}));

			POST("properly shifts layer positions around (1)", r=>r.send({
				position: 2 // move position 1 to position 2
			}).expect(200).then(async () => {
				let [
					layerTmp1, layerTmp2, layerTmp3,
					layer1,    layer2,    layer3,
				] = await requestLayerTemplatesAndLayers();
				expect(layerTmp1).sole.element.to.have.property('position').that.equals(2);
				expect(layerTmp2).sole.element.to.have.property('position').that.equals(1);
				expect(layerTmp3).sole.element.to.have.property('position').that.equals(3);
				expect(layer1)   .sole.element.to.have.property('position').that.equals(2);
				expect(layer2)   .sole.element.to.have.property('position').that.equals(1);
				expect(layer3)   .sole.element.to.have.property('position').that.equals(3);
			}));

			POST("properly keeps layers in place when position is not changed", r=>r.send({
				name: "some other name"
			}).expect(200).then(async () => {
				let [
					layerTmp1, layerTmp2, layerTmp3,
					layer1,    layer2,    layer3,
				] = await requestLayerTemplatesAndLayers();
				expect(layerTmp1).sole.element.to.have.property('position').that.equals(1);
				expect(layerTmp2).sole.element.to.have.property('position').that.equals(2);
				expect(layerTmp3).sole.element.to.have.property('position').that.equals(3);
				expect(layer1)   .sole.element.to.have.property('position').that.equals(1);
				expect(layer2)   .sole.element.to.have.property('position').that.equals(2);
				expect(layer3)   .sole.element.to.have.property('position').that.equals(3);
			}));

		});

		withValidPathParams(()=>({ id: initial.layerTmp3.id }), () => {

			POST("properly shifts layer positions around (2)", r=>r.send({
				position: 1 // move position 3 to position 1
			}).expect(200).then(async () => {
				let [
					layerTmp1, layerTmp2, layerTmp3,
					layer1,    layer2,    layer3,
				] = await requestLayerTemplatesAndLayers();
				expect(layerTmp1).sole.element.to.have.property('position').that.equals(2);
				expect(layerTmp2).sole.element.to.have.property('position').that.equals(3);
				expect(layerTmp3).sole.element.to.have.property('position').that.equals(1);
				expect(layer1)   .sole.element.to.have.property('position').that.equals(2);
				expect(layer2)   .sole.element.to.have.property('position').that.equals(3);
				expect(layer3)   .sole.element.to.have.property('position').that.equals(1);
			}));

		});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('Lyph', () => {

	describeEndpoint('/lyphs',      ['GET', 'POST']);

	describeEndpoint('/lyphs/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));

		withValidPathParams(()=>({ id: initial.lyph1.id }), () => {

			GET("returns a resource with expected fields", r=>r.resource((res) => {
				expect(res).to.have.property('name'           ).that.equals("lyph 1");
				expect(res).to.have.property('species'        ).that.equals("dragon");
				expect(res).to.have.property('template'       ).that.equals(initial.lyphTmp1.id);
				expect(res).to.have.property('layers'         ).with.members([ initial.layer1.id, initial.layer2.id, initial.layer3.id ]);
				expect(res).to.have.property('inLayers'       ).that.is.instanceOf(Array); // TODO: make specific when appropriate
				expect(res).to.have.property('inCompartments' ).that.is.instanceOf(Array); // TODO: make specific when appropriate
			}));

		});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('Layer', () => {

	describeEndpoint('/layers',      ['GET']);

	describeEndpoint('/layers/{id}', ['GET'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));

		withValidPathParams(()=>({ id: initial.layer1.id }), () => {

			GET("returns a resource with expected fields", r=>r.resource((res) => {
				expect(res).to.have.property('template'     ).that.equals(initial.layerTmp1.id);
				expect(res).to.have.property('lyph'         ).that.equals(initial.lyph1.id);
				expect(res).to.have.property('position'     ).that.is.within(1, 3);
				expect(res).to.have.property('coalescesWith').that.is.instanceOf(Array); // TODO: make specific when appropriate
				expect(res).to.have.property('childLyphs'   ).that.is.instanceOf(Array); // TODO: make specific when appropriate
			}));

		});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('Compartments', () => {

	describeEndpoint('/compartments',      ['GET', 'POST']);

	describeEndpoint('/compartments/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));

		// TODO: uncomment and fill in when there is a compartment in the setup
		//withValidPathParams(()=>({ id: SOME_ID }), () => {
		//
		//	GET("returns a resource with expected fields", r=>r.resource((res) => {
		//		expect(res).to.have.property('lyphs').that.is.instanceOf(Array);
		//	}));
		//
		//});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('Border', () => {

	describeEndpoint('/borders',      ['GET']);

	describeEndpoint('/borders/{id}', ['GET'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));

		withValidPathParams(()=>({ id: initial.layer1plus.id }), () => {

			GET("returns a resource with expected fields", r=>r.resource((res) => {
				expect(res).to.have.property('layer').that.equals(initial.layer1.id);
				expect(res).to.have.property('nodes').that.is.instanceOf(Array); // TODO: make specific when appropriate
			}));

		});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('CanonicalTree', () => {

	describeEndpoint('/canonicalTrees',      ['GET', 'POST']);

	describeEndpoint('/canonicalTrees/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

		withInvalidPathParams("non-existing", { id: 999999 });

		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyph1.id }));

		withValidPathParams(()=>({ id: initial.cTree1.id }), () => {

			GET("returns a resource with expected fields", r=>r.resource((res) => {
				expect(res).to.have.property('name'           ).that.equals("canonical tree 1");
				expect(res).to.have.property('levels'         ).with.members([ initial.cTreeLevel1.id, initial.cTreeLevel2.id, initial.cTreeLevel3.id ]);
				expect(res).to.have.property('connectedAt'    ).that.is.instanceOf(Array); // TODO: make specific when appropriate
			}));

		});

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describeResourceType('CanonicalTreeLevel', () => {

	/* local utility function */
	async function requestTreeLevelCount() {
		return (await requestResources(`/canonicalTrees/${initial.cTree1.id}/levels`)).length;
	}
	async function requestTreeLevels() {
		return await Promise.all([
			requestSingleResource(`/canonicalTreeLevel/${initial.cTreeLevel1.id}`),
			requestSingleResource(`/canonicalTreeLevel/${initial.cTreeLevel2.id}`),
			requestSingleResource(`/canonicalTreeLevel/${initial.cTreeLevel3.id}`)
		]);
	}

	// describeEndpoint('/canonicalTreeLevel',      ['GET', 'POST']);

	describeEndpoint('/canonicalTreeLevel/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

		// withInvalidPathParams("non-existing", { id: 999999 });
		//
		// withInvalidPathParams("wrong-type", ()=>({ id: initial.lyph1.id }));

		withValidPathParams(()=>({ id: initial.cTreeLevel1.id }), () => {

			// GET("returns a resource with expected fields", r=>r.resource((res) => {
			// 	expect(res).to.have.property('name'          ).that.equals("canonical tree level 1");
			// 	expect(res).to.have.property('position'      ).that.equals(1);
			// 	expect(res).to.have.property('connectedTrees').that.is.instanceOf(Array); // TODO: make specific when appropriate
			// }));
			//
			// POST("properly shifts layer positions around (1)", r=>r.send({
			// 	position: 2 // move position 1 to position 2
			// }).expect(200).then(async () => {
			// 	expect(await requestTreeLevelCount()).to.equal(3);
			// 	let [cTreeLevel1, cTreeLevel2, cTreeLevel3] = await requestTreeLevels();
			// 	expect(cTreeLevel1).to.have.property('position').that.equals(2);
			// 	expect(cTreeLevel2).to.have.property('position').that.equals(1);
			// 	expect(cTreeLevel3).to.have.property('position').that.equals(3);
			// }));

			POST("properly keeps layers in place when only 'template' is changed and 'tree' is provided redundantly", r=>r.send({
				template: initial.lyphTmp2.id,
				tree:     initial.cTree1.id
			}).expect(200).then(async () => {
				expect(await requestTreeLevelCount()).to.equal(3);
				let [cTreeLevel1, cTreeLevel2, cTreeLevel3] = await requestTreeLevels();
				expect(cTreeLevel1).to.have.property('position').that.equals(1);
				expect(cTreeLevel2).to.have.property('position').that.equals(2);
				expect(cTreeLevel3).to.have.property('position').that.equals(3);
			}));

		});
		//
		// withValidPathParams(()=>({ id: initial.layerTmp3.id }), () => {
		//
		// 	POST("properly shifts layer positions around (2)", r=>r.send({
		// 		position: 1 // move position 3 to position 1
		// 	}).expect(200).then(async () => {
		// 		let [
		// 			layerTmp1, layerTmp2, layerTmp3,
		// 			layer1,    layer2,    layer3
		// 		] = await requestTreeLevels();
		// 		expect(layerTmp1).sole.element.to.have.property('position').that.equals(2);
		// 		expect(layerTmp2).sole.element.to.have.property('position').that.equals(3);
		// 		expect(layerTmp3).sole.element.to.have.property('position').that.equals(1);
		// 		expect(layer1)   .sole.element.to.have.property('position').that.equals(2);
		// 		expect(layer2)   .sole.element.to.have.property('position').that.equals(3);
		// 		expect(layer3)   .sole.element.to.have.property('position').that.equals(1);
		// 	}));
		//
		// });

	});

});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing",    { id: 999999   });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//describeResourceType('RESOURCE-TYPE', () => {
//
//	describeEndpoint('/PATH-1',      ['GET', 'POST']);
//
//	describeEndpoint('/PATH-1/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {
//
//		withInvalidPathParams("non-existing", { id: 999999 });
//
//		withInvalidPathParams("wrong-type", ()=>({ id: initial.lyphTmp1.id }));
//
//		withValidPathParams(()=>({ id: SOME_ID }), () => {
//
//			GET("returns a resource with expected fields", r=>r.resource((res) => {
//
//			}));
//
//		});
//
//	});
//
//});

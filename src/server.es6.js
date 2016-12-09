////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// imports                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* external libs */
import _, {isArray, isString, mapValues} from 'lodash';
import express                from 'express';
import promisify              from 'es6-promisify';
import cors                   from 'cors';
const swaggerMiddleware = promisify(require('swagger-express-middleware'));

/* local stuff */
import LyphNeo4j from './LyphNeo4j.es6.js';
import swagger   from './swagger.es6';
import {
	inspect,
	customError,
	isCustomError,
	cleanCustomError,
	sw,
	extractFieldValues
} from './utility.es6.js';
import {
	relationships,
	resources,
	algorithms
} from './resources.es6.js';
import {
	OK,
	CREATED,
	NO_CONTENT,
	BAD_REQUEST,
	NOT_FOUND,
	CONFLICT,
	GONE,
	PRECONDITION_FAILED,
	INTERNAL_SERVER_ERROR
} from './http-status-codes.es6.js';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// request handlers                                                                                                   //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// TODO: to avoid race conditions, use a Neo4j REST transactions to get some ACID around these multiple queries

const requestHandler = {
	resources: /*get, post*/ {
		async get({db, type}, req, res) {
			let extractedResources = await db.getAllResources(type);
			//TODO: replace with official model library toJSON method
			let resSummary = [...extractedResources].map(val => extractFieldValues(val));
			res.status(OK).jsonp( resSummary);
		},
		async post({db, type}, req, res) {
			let id = await db.createResource(type, req.body);
			let createdResource = await db.getSpecificResources(type, [id]);
			console.log("Resources POST at server", createdResource);
			res.status(CREATED).jsonp(createdResource);
		}
	},
	specificResources: /*get, post, put, delete*/ {
		async get({db, type}, req, res) {
			await db.assertResourcesExist(type, req.pathParams.ids);
			res.status(OK).jsonp(await db.getSpecificResources(type, req.pathParams.ids));
		},
		async post({db, type}, req, res) {
			await db.assertResourcesExist(type, [req.pathParams.id]);
			await db.updateResource(type, req.pathParams.id, req.body);
			res.status(OK).jsonp(await db.getSpecificResources(type, [req.pathParams.id]));
		},
		async put({db, type}, req, res) {
			await db.assertResourcesExist(type, [req.pathParams.id]);
			await db.replaceResource(type, req.pathParams.id, req.body);
			res.status(OK).jsonp(await db.getSpecificResources(type, [req.pathParams.id]));
		},
		async delete({db, type, resources, relationships}, req, res) {
			await db.assertResourcesExist(type, [req.pathParams.id]);
			await db.deleteResource(type, req.pathParams.id);
			res.status(NO_CONTENT).jsonp();
		}
	},
	relatedResources: /*get*/ {
		async get({db, relA}, req, res) {
			await db.assertResourcesExist(relA.resourceClass, [req.pathParams.idA]);
			res.status(OK).jsonp( await db.getRelatedResources(relA, req.pathParams.idA) );
		}
	},
	specificRelatedResource: /*put, delete*/ {
		async put({db, type, relA, relB}, req, res) {
			let {idA, idB} = req.pathParams;
			await Promise.all([
				db.assertResourcesExist(relA.resourceClass	   	   , [idA]),
				db.assertResourcesExist(relA.codomain.resourceClass, [idB])
			]);
			await db.addNewRelatedResource(relA, idA, idB);
			res.status(NO_CONTENT).jsonp();
		},
		async delete({db, type, relA, relB}, req, res) {
			let {idA, idB} = req.pathParams;
			await Promise.all([
				db.assertResourcesExist(relA.resourceClass 		   , [idA]),
				db.assertResourcesExist(relA.codomain.resourceClass, [idB])
			]);
			await db.deleteRelatedResource(relA, idA, idB);
			res.status(NO_CONTENT).jsonp();
		}
	},
	relationships: /*get*/ {
        async get({db, type}, req, res) {
			console.log("Getting relationships ", type);
            res.status(OK).jsonp( await db.getAllRelationships(type) );
        }
    },
	// /HasLayer/{hasLayerID}
    specificRelationships: /*get, post, put, delete*/ {
		async get({db, type}, req, res) {
			await db.assertRelationshipsExist(type, req.pathParams.ids);
			res.status(OK).jsonp(await db.getSpecificRelationships(type, req.pathParams.ids));
		},
		async post({db, type}, req, res) {
			await db.assertRelationshipsExist(type, [req.pathParams.id]);
			await db.updateRelationship(type, req.pathParams.id, req.body);
			res.status(OK).jsonp(await db.getSpecificRelationships(type, [req.pathParams.id]));
		},
		async put({db, type}, req, res) {
			await db.assertRelationshipsExist(type, [req.pathParams.id]);
			await db.replaceRelationship(type, req.pathParams.id, req.body);
			res.status(OK).jsonp(await db.getSpecificRelationships(type, [req.pathParams.id]));
		},
		async delete({db, type, resources, relationships}, req, res) {
			await db.assertRelationshipsExist(type, [req.pathParams.id]);
			await db.deleteRelationship(type, req.pathParams.id);
			res.status(NO_CONTENT).jsonp();
		}
	},
	// /lyphs/{lyphID}/-->HasLayer/{otherLyphIDs}, /lyphs/{lyphID}/<--HasLayer/otherLyphIDs}
	specificRelationshipByResources: /*get, post, put, delete*/ {
		async get({db, type}, req, res) {
			console.log("Get relationships by resource IDs");
			res.status(OK).jsonp();
		},
		async post({db, type}, req, res) {
			console.log("Update relationship by resource IDs");
			res.status(OK).jsonp();
		},
		async put({db, type}, req, res) {
			console.log("Put relationship by resource IDs");
			res.status(OK).jsonp();
		},
		async delete({db, type, resources, relationships}, req, res) {
			console.log("Delete relationship by resource IDs");
			res.status(NO_CONTENT).jsonp();
		}
	},
    relatedRelationships: /* get, delete */{
		async get({db, relA}, req, res) {
			console.log("Get related relationships");
			await db.assertResourcesExist(relA, [req.pathParams.idA]);
			res.status(OK).jsonp( await db.getRelatedRelationships(relA, req.pathParams.idA) );
		}
	},
    specificRelatedRelationships: /*get, post*/{
		async put({db, relA, type}, req, res) {
			console.log("Add specific related relationship ", relA);
			let {idA} = req.pathParams;
			//let relProps = req.body;
			await db.addRelationship(type, idA);
			res.status(NO_CONTENT).jsonp();
		},
		async delete({db, relA}, req, res) {
			let {idA, idB} = req.pathParams;
			console.log("Delete specific related relationship ", relA);
			// await Promise.all([
			// 	db.assertResourcesExist(relA.resourceClass 		   , [idA]),
			// 	db.assertResourcesExist(relA.codomain.resourceClass, [idB])
			// ]);
			await db.deleteRelatedResource(relA, idA, idB);
			res.status(NO_CONTENT).jsonp();
		}
	},
	algorithm: {
		async get({db, algorithmName}, req, res) {
			let result = await algorithms[algorithmName].run({
				resources,
				relationships,
				algorithms,
				db,
				...pick(req, [
					'pathParams',
					'body'
				])
			});
			res.status(result ? OK : NO_CONTENT).jsonp(result);
		}
	}
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// internal middleware                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* parameter normalizer */
function parameterNormalizer(req, res, next) {
	for (let newIdKey of Object.keys(req.swagger.path['x-param-map'] || {})) {
		let oldIdKey = req.swagger.path['x-param-map'][newIdKey];
		req.pathParams[newIdKey] = req.pathParams[oldIdKey];
	}
	return next();
}


/* error normalizer */
function errorNormalizer(err, req, res, next) {

	/* custom errors coming from our own code */
	if (isCustomError(err)) {
		return next(cleanCustomError(err));
	}

	/* swagger errors */
	if (err.message && err.message.match(/^\d\d\d Error:/)) {
		let messages = [];
		let properties = {};
		for (let msgPart of err.message.split('\n')) {
			let match = msgPart.match(/\d\d\d Error: (.*)/);
			if (match) {
				messages.push(match[1]);
				continue;
			}
			match = msgPart.match(/(.*?): \s*"?([^"]*)"?\s*/);
			if (match) {
				properties[match[1]] = match[2];
				continue;
			}
		}
		return next({
			info:    properties,
			status:  err.status,
			message: messages.map(msg => msg.replace(/"([\w\d\-_\s]+?)"/g, "'$1'")).join(' ')
			//       ^ we like single-quoted strings
		});
	}

	/* Neo4j errors */
	if (isArray(err) && isString(err[0].code) && err[0].code.startsWith('Neo.')) {
		if (Array.isArray(err) && err.length === 1) { err = err[0] }
		return next({
			status:  INTERNAL_SERVER_ERROR,
			message: "An error occurred in the database that we did not expect. Please let us know!",
			originalError: err
		});
	}

	/* any other errors */
	return next({
		status:  INTERNAL_SERVER_ERROR,
		message: "An error occurred on the server that we did not expect. Please let us know!",
		originalError: err
	});

}


/* error logging */
function errorLogger(err, req, res, next) {
	console.error(`[Server] [${Date()}]`, JSON.stringify(err, null, 4));
	return next(err);
}


/* error transmission */
function errorTransmitter(err, req, res, next) {
	res.status(err.status).jsonp(err);
	return next(err);
}


/* done with error */
function doneWithError(err, req, res, next) {}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// the server                                                                                                         //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export default async (distDir, config) => {

	/* the express application */
	let server = express();

	/* serve swagger-ui based documentation */
	server.use('/docs', express.static(`${distDir}/docs/`));

	/* enable CORS (Cross Origin Resource Sharing) */
	server.use(cors());

	/* load the middleware */
	let [middleware] = await swaggerMiddleware(`${distDir}/swagger.json`, server);

	/* use Swagger middleware */
	//noinspection JSUnresolvedFunction (there is no .d.ts file for swagger-express-middleware)
	server.use(
		middleware.files({ apiPath: false, rawFilesPath: '/' }),
		middleware.metadata(),
		middleware.parseRequest(),
		middleware.validateRequest()
	);

	console.log("DB CONFIG", config);

	/* set up database */
	let db = new LyphNeo4j({
		user:           config.dbUser,
		pass:           config.dbPass,
		host:           config.dbHost,
		port:           config.dbPort,
		docker:         config.dbDocker,
		consoleLogging: config.dbConsoleLogging
	});

	/* create uniqueness constraints for all resource types (only if database is new) */
	await Promise.all(_(resources).keys().map(r => db.createUniqueIdConstraintOn(r)));

	/* normalize parameter names */
	server.use(parameterNormalizer);

	/* request handling */
	for (let path of Object.keys(swagger.paths)) {
		let pathObj = swagger.paths[path];
		let expressStylePath = path.replace(/{(\w+)}/g, ':$1');
		for (let method of _(pathObj).keys().intersection(['get', 'post', 'put', 'delete'])) {
			let info = sw(pathObj['x-path-type'])(
				[['resources', 'specificResources'], ()=>({
					type: resources[pathObj['x-resource-type']]
				})],
				[['relatedResources', 'specificRelatedResource'], ()=> ({
					type: relationships[pathObj['x-relationship-type']],
					relA: relationships[pathObj['x-relationship-type']].domainPairs[pathObj['x-i']][pathObj['x-A']],
					relB: relationships[pathObj['x-relationship-type']].domainPairs[pathObj['x-i']][pathObj['x-B']]
				})],
                [['relationships', 'specificRelationships'], ()=>({
                    type: relationships[pathObj['x-relationship-type']]
                })],
                [['relatedRelationships', 'specificRelatedRelationship', 'specificRelationshipByResources'], ()=>({
                    type: relationships[pathObj['x-relationship-type']],
					relA: relationships[pathObj['x-relationship-type']].domainPairs[pathObj['x-i']][pathObj['x-A']],
					relB: relationships[pathObj['x-relationship-type']].domainPairs[pathObj['x-i']][pathObj['x-B']]
                })],
				[['algorithm'], ()=>({
					algorithmName: pathObj['x-algorithm-name']
				})]
			);
			Object.assign(info, { db });
			server[method](expressStylePath, (req, res, next) => {
				try { requestHandler[pathObj['x-path-type']][method](info, req, res).catch(next) }
				catch (err) { next(err) }
			});
		}
	}

	/* handling error messages */
	server.use(errorNormalizer);
	if (config.consoleLogging !== false) { server.use(errorLogger) }
	server.use(errorTransmitter);
	server.use(doneWithError);

	/* return the server app and possibly database */
	return config.exposeDB ? { database: db, server } : server;

};

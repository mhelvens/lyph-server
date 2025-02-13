////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// imports                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';

/* external libs */
// import _ from 'lodash';
import isArray from 'lodash-bound/isArray';
import isNull from 'lodash-bound/isNull';
import isUndefined from 'lodash-bound/isUndefined';
import isObject from 'lodash-bound/isObject';
import isInteger from 'lodash-bound/isInteger';
import omit from 'lodash-bound/omit';
import entries from 'lodash-bound/entries';
import keys from 'lodash-bound/keys';
import intersection from 'lodash-bound/intersection';
import pick from 'lodash-bound/pick';
import omitBy from 'lodash-bound/omitBy';
import assert from 'power-assert';

import express                from 'express';
import promisify              from 'es6-promisify';
import cors                   from 'cors';
const swaggerMiddleware = promisify(require('swagger-express-middleware'));

/* local stuff */
import LyphNeo4j from './LyphNeo4j.es6.js';
import swagger   from './swagger.es6';
import {
	isCustomError,
	cleanCustomError
} from './utils/utility.es6.js';
import {
	OK,
	CREATED,
	NO_CONTENT,
	NOT_FOUND,
	INTERNAL_SERVER_ERROR
} from './http-status-codes.es6.js';
import { createModelWithBackend } from './model.es6.js';
import {sw, humanMsg} from 'utilities';

import {customError} from './utils/utility.es6.js';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// request handlers                                                                                                   //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let model;

/*Helpers*/
async function createModelResource(db, cls, fields, options = {}) {
	let allExposedRelationshipFields  = {
		...cls.relationships::omitBy(fieldSpec => fieldSpec.relationshipClass.abstract),
		...cls.relationshipShortcuts
	};
	for (let [fieldName, fieldSpec] of Object.entries(allExposedRelationshipFields)){
		let addressOrAddresses = fields[fieldName];
		if (addressOrAddresses::isUndefined() || addressOrAddresses::isNull()) { continue }
		fields[fieldName] = await model.get(addressOrAddresses);
		// if (!addressOrAddresses::isArray()) { addressOrAddresses = [addressOrAddresses] }
		// if (fieldSpec.cardinality.max === 1) {
		// 	fields[fieldName] = await model.get(addressOrAddresses[0]);
		// } else {
		// 	fields[fieldName] = await model.get(addressOrAddresses);
		// }
	}
	return model.new({ ...fields, class: cls.name }, options);
}

async function getRelatedResources(db, address, key){
	let [resource] = await model.get([address]);
	return await model.get([...resource[key]]);
}

const getInfo = (pathObj) => sw(pathObj['x-path-type'])(
	[['clear'], ()=>({})],
	[['resources', 'specificResources'], ()=>({
		cls: model.entityClasses[pathObj['x-resource-type']]
	})],
	[['relatedResources', 'specificRelatedResource'], ()=> ({
		cls: model.entityClasses[pathObj['x-resource-type']],
		relA: model.entityClasses[pathObj['x-resource-type']].relationships[pathObj['x-relationship-type']]
	})]
);

function nonExistingEntitiesError(cls, ids) {
	return customError({
		status: NOT_FOUND,
		class: cls.name,
		ids: ids,
		message: humanMsg`Not all specified ${cls.name} entities with IDs '${ids.join(',')}' exist.`
	});
}

function entityToJSON(entity) {
	let result = {};
	for (let [key, field] of entity.fields::entries()) {
		if (field instanceof model.Rel1Field) {

			if (key[0] !== '<' && key[0] !== '-')           { continue }
			if (model.entityClasses[key.slice(3)].abstract) { continue }
			if (!field.get())                               { continue }
			result[key] = field.get()::pick('id', 'class');

		} else if (field instanceof model.Rel$Field) {

			if (key[0] !== '<' && key[0] !== '-')           { continue }
			if (model.entityClasses[key.slice(3)].abstract) { continue }
			if (field.get().size === 0)                     { continue }
			result[key] = [...field.get()].map(entity => entity::pick('class', 'id'));

		} else if (field instanceof model.PropertyField) {

			if (field.get()::isUndefined()) { continue }
			result[key] = field.get();

		}
	}
	return result;
}

const requestHandler = {
	clear: {
		async post({db}, req, res){
			db.clear('Yes! Delete all everythings!');
			return {statusCode: NO_CONTENT};
		}
	},

	resources: /*get, post*/ {
		async get({db, cls}, req, res) {
			let response = ( await model.getAll({ class: cls.name }) ).map(entityToJSON);
			return {statusCode: OK, response: response};
		},
		async post({db, cls}, req, res) {
			let entity = await createModelResource(db, cls, req.body);
			return {statusCode: CREATED, entity: entity};
		}
	},

	specificResources: /*get, post, put, delete*/ {
		async get({db, cls}, req, res) {
			let entities = [...await model.get(req.pathParams.ids.map(id=>({ class: cls.name, id })))];
			if (entities.includes(null)) { throw nonExistingEntitiesError(cls, req.pathParams.ids) }
			return { statusCode: OK, response: entities.map(entityToJSON) };
		},
		async post({db, cls}, req, res) {
			let entity = await model.get({ class: cls.name, id: req.pathParams.id });
			if (entity === null) { throw nonExistingEntitiesError(cls, [req.pathParams.id]) }
			model.setEntityFields(entity, req.body);
			return {statusCode: OK, entity: entity};
		},
		async put({db, cls}, req, res) {
			let entity = await model.get({ class: cls.name, id: req.pathParams.id });
			if (entity === null) { throw nonExistingEntitiesError(cls, [req.pathParams.id]) }
			model.resetEntityFields(entity);
			model.setEntityFields(entity, req.body);
			return {statusCode: OK, entity: entity};
		},
		async delete({db, cls}, req, res) {
			let entity = await model.get({ class: cls.name, id: req.pathParams.id });
			if (entity === null) { throw nonExistingEntitiesError(cls, [req.pathParams.id]) }
			entity.delete();
			return {statusCode: NO_CONTENT, entity: entity};
		}
	},

	relatedResources: /*get*/ {
		async get({db, cls, relA}, req, res) {
			let entity = await model.get({class: relA.resourceClass.name, id: req.pathParams.idA});
			if (entity === null) { throw nonExistingEntitiesError(cls, [req.pathParams.idA]) }

			let related = await model.get([...entity.fields[relA.keyInResource].get()]);
			let response = related.map(entityToJSON);
			return {statusCode: OK, response: response};
		}
	},

	specificRelatedResource: /*put, delete*/ {
		async put({db, cls, relA}, req, res) {
			let {idA, idB} = req.pathParams;
			let [resA, resB] = await model.get([
				{ class: relA.resourceClass.name,          id: idA },
				{ class: relA.codomain.resourceClass.name, id: idB }
			]);
			resA.fields[relA.keyInResource].add(resB);
			return {statusCode: NO_CONTENT, entity: resA};
		},
		async delete({db, cls, relA}, req, res) {
			let {idA, idB} = req.pathParams;
			let [resA, resB] = await model.get([
				{ class: relA.resourceClass.name,          id: idA },
				{ class: relA.codomain.resourceClass.name, id: idB }
			]);
			resA.fields[relA.keyInResource].delete(resB);
			return {statusCode: NO_CONTENT, entity: resA};

			// let relatedResources = await getRelatedResources(db, relA.resourceClass, req.pathParams.idA, relA.keyInResource);
			// let entity = relatedResources.find(rel => rel.id === idB);
			// if (!entity){ return {statusCode: NOT_FOUND}; }
			// entity.delete();
			// return {statusCode: NO_CONTENT, entity: entity};
		}
	},
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// internal middleware                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function decodePath (req, res, next) {
	req.url = decodeURI(req.url);
	return next();
}

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
	if (err::isArray() && err[0].code::isString() && err[0].code.startsWith('Neo.')) {
		if (err::isArray() && err.length === 1) { err = err[0] }
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

	/* decode URI */
	server.use(decodePath);

	/* use Swagger middleware */
	//noinspection JSUnresolvedFunction (there is no .d.ts file for swagger-express-middleware)
	server.use(
		middleware.files({ apiPath: false, rawFilesPath: '/' }),
		middleware.metadata(),
		middleware.parseRequest(),
		middleware.validateRequest()
	);

	/* set up database */
	let db = new LyphNeo4j({
		user:           config.dbUser,
		pass:           config.dbPass,
		host:           config.dbHost,
		port:           config.dbPort,
		docker:         config.dbDocker,
		consoleLogging: config.dbConsoleLogging,
		baseURL: 		`http://${config.host}:${config.port}`
	});

	/* normalize parameter names */
	server.use(parameterNormalizer);

	/* set global variable `model` = the open-physiology-model instance */
	model = createModelWithBackend(db);

	/* create uniqueness constraints for all resource types (only if database is new) */
	await Promise.all(
		Object.keys(model.entityClasses)
			.filter(key => model.entityClasses[key].isResource)
			.map(r => db.createUniqueIdConstraintOn(r))
	);

	/* request handling */
	for (let path of Object.keys(swagger.paths)) {
		const expressStylePath = path.replace(/{(\w+)}/g, ':$1');
		const pathObj = swagger.paths[path];
		for (let method of pathObj::keys()::intersection(['get', 'post', 'put', 'delete'])) {
			const info = getInfo(pathObj);
			server[method](expressStylePath, async (req, res, next) => {
				let result = {};
				try {
					req.url = encodeURI(req.url);
					result = await requestHandler[pathObj['x-path-type']][method]({...info, db}, req, res);
					if (result.entity){
						await model.commit();
						if (result.status !== NO_CONTENT) {
							result.response = [entityToJSON(result.entity)];
						}
					}
				} catch (err) {
					result = {statusCode: err.status, response: err};
				}
				res.status(result.statusCode).jsonp(result.response);
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

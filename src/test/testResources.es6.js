/**
 * Created by Natallia on 12/1/2016.
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// imports                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import _, {template, isString, isFunction, isArray, isUndefined} from 'lodash';
import {expect} from 'chai';
import {initial, describeResourceClass, describeEndpoint,
    GET, POST, PUT, DELETE,
    withInvalidPathParams, withValidPathParams,
    requestSingleResource} from './testUtils.es6.js';

import {model} from '../resources.es6.js';
import {OK, NO_CONTENT} from "../http-status-codes.es6";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//Run just one test (helps to check one thing at the development time )
export function runSelectedTest(){
    describeResourceClass('Lyph', () => {
        describeEndpoint('/lyphs', ['GET', 'POST']);

        describeEndpoint('/lyphs/{lyphID}/layers', ['GET', 'POST'], () => {
            withValidPathParams(()=>({lyphID: initial.mainLyph1.id}), () => {
                GET("returns layers", r=>r.expectArrayWith((res) => {}));
            });
        });

        describeEndpoint('/lyphs/{lyphID}/layers/{otherLyphID}', ['PUT', 'DELETE'], () => {

            withValidPathParams(()=>({lyphID: initial.mainLyph1.id, otherLyphID: initial.lyph3.id}), () => {

                //Add new layer
                PUT("returns a lyph with added layer", r=>r.send({
                    //TODO send properties of new relationship
                }).expect(NO_CONTENT).then(async() => {
                    //TODO test that layer has been added
                }));

                DELETE("returns a lyph with removed layer", r=>r.send({

                }).expect(NO_CONTENT).then(async() => {
                    //TODO test that layer has been removed
                }));

            });
        });
    });
}

/* Test all resource endpoints */
export function testResources() {


    describeResourceClass('ExternalResource', () => {

        let newExternalResource = async () => {
            let newRes = model.ExternalResource.new({
                name: "Right fourth dorsal metatarsal vein",
                uri: "http://purl.obolibrary.org/obo/FMA_44515",
                type: "fma"
            });
            await newRes.commit();
            return _(newRes.fields).mapValues((val) => (val.value)).value();
        };
        describeEndpoint('/externalResources', ['GET', 'POST']);

        describeEndpoint('/externalResources/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.border1.id}));

            withValidPathParams(()=>({id: initial.externalResource1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    expect(res).to.have.property('uri');   //{ ...uriSchema, required: true },
                    expect(res).to.have.property('type').that.equals("fma");  //{ type: 'string'}

                }));

                POST("updates a given resource", r=>r.send({
                    type: "obo",
                    name: "socket cell (sensu Nematoda)"
                    }).expect(OK).then(async() => {
                        let res = await requestSingleResource(`/externalResources/${initial.externalResource1.id}`);
                        expect(res).to.have.property('type').that.equals("obo");
                        expect(res).to.have.property('name').that.equals("socket cell (sensu Nematoda)");
                    }));

                //TODO: why bad request?
                // PUT("replace a given external resource", r=>r.send(
                //     newExternalResource
                // ).expect(OK).then(async() => {
                //     let res = await requestSingleResource(`/externalResources/${newExternalResource.id}`);
                //     expect(res).to.have.property('name').that.equals("Right fourth dorsal metatarsal vein");
                // }));

                //DELETE("delete a given external resource", r=>r.expect(NO_CONTENT));
            });
        });

        describeEndpoint('/externalResources/{id}/locals', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.externalResource1.id}), () => {
                GET("returns locals", r =>r.expectArrayWith((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                }));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Border', () => {

        describeEndpoint('/borders', ['GET', 'POST']);

        describeEndpoint('/borders/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.border1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');     //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');   //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class');  //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('nature'); //{ ...},
                }));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Material', () => {

        describeEndpoint('/materials', ['GET', 'POST']);

        describeEndpoint('/materials/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.material1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                }));
            });
        });

        describeEndpoint('/materials/{id}/materials', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.material1.id}), () => {
                GET("returns materials", r=>r.expectArrayWith((res) => {}));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Measurable', () => {

        describeEndpoint('/measurables', ['GET', 'POST']);

        describeEndpoint('/measurables/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.measurable1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id'); //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href'); //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name'); //{ type: 'string' }
                    //expect(res).to.have.property('materials').with.members([ initial.materialType1.id]);
                }));
            });
        });

        describeEndpoint('/measurables/{id}/materials', ['GET', 'POST'], ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.measurable1.id}), () => {
                GET("returns materials", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/measurables/{id}/locations', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.measurable1.id}), () => {
                GET("returns locations", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/measurables/{id}/effects', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.measurable1.id}), () => {
                GET("returns effects", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/measurables/{id}/causes', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.measurable1.id}), () => {
                GET("returns causes", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Causality', () => {

        describeEndpoint('/causalities', ['GET', 'POST']);

        describeEndpoint('/causalities/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.causality1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id'); //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href'); //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('cause').that.equals(initial.measurable1.id);
                    expect(res).to.have.property('effect').that.equals(initial.measurable2.id);
                }));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Lyph', () => {

        describeEndpoint('/lyphs', ['GET', 'POST']);

        describeEndpoint('/lyphs/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id'); //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href'); //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');
                    expect(res).to.have.property('species');
                    expect(res).to.have.property('layers').with.members([initial.lyph1.id, initial.lyph2.id]);
                    expect(res).to.have.property('parts').with.members([initial.lyph1.id, initial.lyph2.id]);
                    expect(res).to.have.property('externals').with.members([initial.externalResource1.id]);
                    expect(res).to.have.property('longitudinalBorders').with.members([initial.border1.id, initial.border2.id]);
                    expect(res).to.have.property('radialBorders');
                    expect(res).to.have.property('axis');
                    expect(res).to.have.property('thickness').that.deep.equals({value: 1});
                    expect(res).to.have.property('length').that.deep.equals({min: 1, max: 10});
                    //expect(res).to.have.property('segments');
                    //expect(res).to.have.property('patches');
                    //expect(res).to.have.property('coalecences');
                    //expect(res).to.have.property('incomingProcesses');
                    //expect(res).to.have.property('outgoingProcesses');
                    //expect(res).to.have.property('processes');
                    //expect(res).to.have.property('nodes');
                    //expect(res).to.have.property('materials').with.members([ initial.materialType1.id]);
                    expect(res).to.have.property('measurables').with.members([initial.measurable1.id]);
                }));
            });
        });

        describeEndpoint('/lyphs/{id}/parts', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns parts", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/layers', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns layers", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/patches', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns patches", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/segments', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns segments", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/borders', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns borders", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/longitudinalBorders', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns longitudinal borders", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/radialBorders', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns radial borders", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/coalescences', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns coalescences", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/outgoingProcesses', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns ongoing processes", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/incomingProcesses', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns incoming processes", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/lyphs/{id}/processes', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {
                GET("returns processes", r=>r.expectArrayWith((res) => {}));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Node', () => {

        describeEndpoint('/nodes', ['GET', 'POST']);

        describeEndpoint('/nodes/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.node1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id'); //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href'); //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('measurables').with.members([initial.measurable1.id]);
                    //expect(res).to.have.property('outgoingProcesses');
                    //expect(res).to.have.property('incomingProcesses');
                    //expect(res).to.have.property('channels');
                    expect(res).to.have.property('locations').with.members( [initial.mainLyph1.id]);
                }));
            });
        });

        describeEndpoint('/nodes/{id}/outgoingProcesses', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.node1.id}), () => {
                GET("returns outgoing processes", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/nodes/{nodeID}/incomingProcesses', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.node1.id}), () => {
                GET("returns incoming processes", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/nodes/{nodeID}/channels', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.node1.id}), () => {
                GET("returns channels", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/nodes/{nodeID}/locations', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.node1.id}), () => {
                GET("returns locations", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Process', () => {

        describeEndpoint('/processes', ['GET', 'POST']);

        describeEndpoint('/processes/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.process1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id'); //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href'); //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('transportPhenomenon').that.equals("advection")//,
                    // expect(res).to.have.property('sourceLyph').that.equals(initial.lyph1.id);
                    // expect(res).to.have.property('targetLyph').that.equals(initial.lyph2.id);
                    // expect(res).to.have.property('conveyingLyph').with.members([initial.mainLyph1.id]);
                }));
            });
        });

        describeEndpoint('/processes/{id}/conveyingLyph', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.process1.id}), () => {
                GET("returns outgoing processes", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/processes/{id}/materials', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.process1.id}), () => {
                GET("returns materials", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/processes/{id}/channels', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.process1.id}), () => {
                GET("returns channels", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/processes/{id}/segments', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.process1.id}), () => {
                GET("returns segments", r=>r.expectArrayWith((res) => {}));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Group', () => {

        describeEndpoint('/groups', ['GET', 'POST']);

        describeEndpoint('/groups/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.group1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    expect(res).to.have.property('elements').with.members([ initial.lyph1.id, initial.node1.id]);
                }));
            });
        });

        describeEndpoint('/groups/{id}/elements', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.group1.id}), () => {
                GET("returns elements", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('OmegaTree', () => {

        describeEndpoint('/omegaTrees', ['GET', 'POST']);

        describeEndpoint('/omegaTrees/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.omegaTree1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    //expect(res).to.have.property('parts').with.members([ initial.lyph1.id, initial.lyph2.id, initial.lyph3.id ]);
                }));
            });
        });

        describeEndpoint('/omegaTrees/{id}/root', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.omegaTree1.id}), () => {
                GET("returns root nodes", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/omegaTrees/{id}/parts', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.process1.id}), () => {
                GET("returns parts", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Publication', () => {

        describeEndpoint('/publications', ['GET', 'POST']);

        describeEndpoint('/publications/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.publication1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                }));
            });
        });

        describeEndpoint('publications/{id}/correlations', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.publication1.id}), () => {
                GET("returns correlations", r=>r.expectArrayWith((res) => {}));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('ClinicalIndex', () => {

        describeEndpoint('/clinicalIndices', ['GET', 'POST']);

        describeEndpoint('/clinicalIndices/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.clinicalIndex2.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    expect(res).to.have.property('parent').that.equals(initial.clinicalIndex1.id);
                }));
            });
        });

        describeEndpoint('clinicalIndices/{id}/children', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.clinicalIndex1.id}), () => {
                GET("returns clinical indices", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Correlation', () => {

        describeEndpoint('/correlations', ['GET', 'POST']);

        describeEndpoint('/correlations/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.correlation1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('publication').that.equals(initial.publication1.id);
                    expect(res).to.have.property('clinicalIndices').with.members([initial.clinicalIndex1.id, initial.clinicalIndex2.id]);
                    expect(res).to.have.property('measurables').with.members([initial.measurable1.id, initial.measurable2.id]);
                }));
            });
        });

        describeEndpoint('/correlations/{id}/measurables', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.correlation1.id}), () => {
                GET("returns measurables", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/correlations/{id}/clinicalIndices', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.correlation1.id}), () => {
                GET("returns clinical indices", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Coalescence', () => {

        describeEndpoint('/coalescences', ['GET', 'POST']);

        describeEndpoint('/coalescences/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.coalescence1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('lyphs').with.members([initial.lyph1.id, initial.lyph2.id]);
                }));
            });
        });

        describeEndpoint('/coalescences/{id}/lyphs', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.coalescence1.id}), () => {
                GET("returns lyphs", r=>r.expectArrayWith((res) => {}));
            });
        });
        describeEndpoint('/coalescences/{id}/scenarios', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.coalescence1.id}), () => {
                GET("returns scenarios", r=>r.expectArrayWith((res) => {}));
            });
        });

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('CoalescenceScenario', () => {

        describeEndpoint('/coalescenceScenarios', ['GET', 'POST']);

        describeEndpoint('/coalescenceScenarios/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.coalescenceScenario1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('lyphs').with.members([initial.mainLyph1.id, initial.mainLyph2.id]);
                }));
            });
        });

        describeEndpoint('/coalescenceScenarios/{id}/lyphs', ['GET', 'POST'], () => {
            withValidPathParams(()=>({id: initial.coalescenceScenario1.id}), () => {
                GET("returns lyphs", r=>r.expectArrayWith((res) => {}));
            });
        });
    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Type', () => {

        describeEndpoint('/types', ['GET', 'POST']);

        describeEndpoint('/types/{id}', ['GET', 'POST', 'PUT', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            //TODO uncomment when materialType1 is created
            // withValidPathParams(()=>({id: initial.materialType1.id}), () => {
            //
            //     GET("returns a resource with expected fields", r=>r.resource((res) => {
            //         expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
            //         expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
            //         expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
            //         expect(res).to.have.property('name');  //{ type: 'string' }
            //         expect(res).to.have.property('definition').that.equals(initial.material1.id);
            //     }));
            //
            // });
        });

        //TODO uncomment when materialType1 is created
        // describeEndpoint('/types/{id}/subtypes', ['GET', 'POST'], () => {
        //     withValidPathParams(()=>({id: initial.materialType1.id}), () => {
        //         GET("returns subtypes", r=>r.expectArrayWith((res) => {}));
        //     });
        // });
        // describeEndpoint('/types/{typeID}/supertypes', ['GET', 'POST'], () => {
        //     withValidPathParams(()=>({id: initial.materialType2.id}), () => {
        //         GET("returns supertypes", r=>r.expectArrayWith((res) => {}));
        //     });
        // });

    });


}


/* Test abstract resources */
export function testAbstractResources(){


    describeResourceClass('Resource', () => {

        describeEndpoint('/resources', ['GET', 'POST']);

        describeEndpoint('/resources/{id}', ['GET', 'POST', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withValidPathParams(()=>({id: initial.externalResource1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                }));
            });
        });

        describeEndpoint('/resources/{resourceID}/externals', ['GET', 'POST']);
        describeEndpoint('/resources/{resourceID}/themes', ['GET', 'POST']);

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('Template', () => {

        describeEndpoint('/templates', ['GET', 'POST']);

        describeEndpoint('/templates/{id}', ['GET', 'POST', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    expect(res).to.have.property('cardinalityBase');
                    expect(res).to.have.property('species');
                }));
            });
        });

        describeEndpoint('/templates/{templateID}/cardinalityMultipliers', ['GET', 'POST']);
        describeEndpoint('/templates/{templateID}/types', ['GET', 'POST']);
        describeEndpoint('/templates/{templateID}/children', ['GET', 'POST']);
        describeEndpoint('/templates/{templateID}/parents', ['GET', 'POST']);

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('NodeLocation', () => {

        describeEndpoint('/nodeLocations', ['GET', 'POST']);

        describeEndpoint('/nodeLocations/{id}', ['GET', 'POST', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.mainLyph1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    expect(res).to.have.property('cardinalityBase');
                    expect(res).to.have.property('species');
                }));
            });
        });

        describeEndpoint('/nodeLocations/{nodeLocationID}/nodes', ['GET', 'POST']);

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('MeasurableLocation', () => {

        describeEndpoint('/measurableLocations', ['GET', 'POST']);

        describeEndpoint('/measurableLocations/{id}', ['GET', 'POST', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.node1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                    expect(res).to.have.property('cardinalityBase');
                    expect(res).to.have.property('species');
                }));
            });
        });

        describeEndpoint('/measurableLocations/{measurableLocationID}/measurables', ['GET', 'POST']);

    });


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    describeResourceClass('OmegaTreePart', () => {

        describeEndpoint('/omegaTreeParts', ['GET', 'POST']);

        describeEndpoint('/omegaTreeParts/{id}', ['GET', 'POST', 'DELETE'], () => {

            withInvalidPathParams("non-existing", {id: 999999});

            withInvalidPathParams("wrong-class", ()=>({id: initial.externalResource1.id}));

            withValidPathParams(()=>({id: initial.lyph1.id}), () => {

                GET("returns a resource with expected fields", r=>r.resource((res) => {
                    expect(res).to.have.property('id');    //{ ...idSchema,         readonly: true },
                    expect(res).to.have.property('href');  //{ ...uriSchema,        readonly: true },
                    expect(res).to.have.property('class'); //{ ...identifierSchema, readonly: true },
                    expect(res).to.have.property('name');  //{ type: 'string' }
                }));
            });
        });

        describeEndpoint('/omegaTreeParts/{omegaTreePartID}/treeChildren', ['GET', 'POST']);

    });

}

////////////////////////////////////
//Untested relatedResource endpoints
////////////////////////////////////

// describeEndpoint('/themes/{themeID}/resources', ['GET', 'POST']);
// describeEndpoint('/artefactContainers/{artefactContainerID}/children', ['GET', 'POST']);
// describeEndpoint('/0-dimensionalContainers/{0-dimensionalContainerID}/children', ['GET', 'POST']);
// describeEndpoint('/1-dimensionalContainers/{1-dimensionalContainerID}/children', ['GET', 'POST']);
// describeEndpoint('/1-dimensionalContainers/{1-dimensionalContainerID}/children', ['GET', 'POST']);
// describeEndpoint('/2-dimensionalContainers/{2-dimensionalContainerID}/children', ['GET', 'POST']);
// describeEndpoint('/2-dimensionalContainers/{2-dimensionalContainerID}/children', ['GET', 'POST']);
// describeEndpoint('/2-dimensionalContainers/{2-dimensionalContainerID}/children', ['GET', 'POST']);






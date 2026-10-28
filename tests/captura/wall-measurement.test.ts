import { describe,it,expect } from "vitest";
import { measurementFromWallCandidate } from "../../src/lib/captura/wall-measurement";
import { samplePlan } from "../../src/lib/captura/sample-plan";
import { fixture,id,articles,organization } from "./fixture";
import { createEstimateProposal } from "../../src/lib/captura/estimate";
const options=()=>({
  extraction:samplePlan,source:{...fixture().sources[0],sha256:samplePlan.sha256},
  calibration:{...fixture().calibrations[0],start:[20,40] as [number,number],end:[220,40] as [number,number]},
  rules:[{color:[255,0,0],action:"demolish"}],candidate_id:"1:demoler-a:demolish",measurement_id:id(30),label:"Tabique propuesto"
});
describe("De candidato revisable a medición y partida",()=>{
  it("mide el eje de 5 m, conserva los trazados y calcula 12,5 m² con altura declarada de 2,5 m",()=>{
    const input=fixture(),opts=options();input.sources=[opts.source,{id:id(11),kind:"manual",label:"Altura de visita",phase:"existing",legend:""}];
    input.calibrations=[opts.calibration];input.measurements=[measurementFromWallCandidate(opts),
      {id:id(31),source_id:id(11),label:"Altura",kind:"quantity",value:2.5,unit:"ml",method:"manual",reference:"Introducida por el técnico"}];
    input.intents[0].article_id=id(4);input.intents[0].formula={kind:"wall_area",length_id:id(30),height_id:id(31),opening_ids:[]};
    const proposal=createEstimateProposal(input,{organization_id:organization,articles});
    expect(proposal.lines[0].item?.quantity).toBe(12.5);expect(proposal.priced_subtotal.base).toBe(35000);
    expect(proposal.measurement_inputs[0]).toMatchObject({derived_from_path_ids:["demoler-a","demoler-a-duplicado"]});
    expect(proposal.review_required).toBe(true);
  });
  it("rechaza otro archivo, leyenda o página y no acepta un candidato inventado",()=>{
    const opts=options();expect(()=>measurementFromWallCandidate({...opts,source:{...opts.source,sha256:"a".repeat(64)}})).toThrow(/PDF/);
    expect(()=>measurementFromWallCandidate({...opts,rules:[]})).toThrow(/propuesta/);
    expect(()=>measurementFromWallCandidate({...opts,calibration:{...opts.calibration,page:2}})).toThrow(/página/);
    expect(()=>measurementFromWallCandidate({...opts,candidate_id:"inexistente"})).toThrow(/propuesta/);
  });
});

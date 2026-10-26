import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,describe,it,expect } from "vitest";
import { demoId } from "@/lib/demo";
import { lineTotal,type BudgetItem } from "@/lib/domain";

let db:PGlite;
const org=demoId(1),otherOrg=demoId(2),admin=demoId(3),site=demoId(4),viewer=demoId(5),manager=demoId(6),outsider=demoId(7);
const firstItem:BudgetItem={id:demoId(100),chapter:"Pintura",description:"Paredes",quantity:12.125,unit:"m²",unit_price:1450,adjustment_percent:12.25,vat_rate:21,inclusion:"included"};
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,owner_id text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/202610260001_workspace.sql",import.meta.url),"utf8"));
},30000);
beforeEach(async()=>{
  await db.exec(`reset role; truncate public.organizations cascade; truncate auth.users cascade; truncate storage.objects;`);
  await db.query(`insert into auth.users(id) select unnest($1::uuid[])`,[[admin,site,viewer,manager,outsider]]);
  await db.query(`insert into public.organizations(id,name) values($1,'GARAL prueba'),($2,'Otra empresa')`,[org,otherOrg]);
  for(const [id,role] of [[admin,"admin"],[site,"site"],[viewer,"viewer"],[manager,"manager"]]) await db.query(`insert into public.organization_members values($1,$2,$3,$4)`,[org,id,`Usuario ${role}`,role]);
  await db.query(`insert into public.organization_members values($1,$2,'Otra persona','admin')`,[otherOrg,outsider]);
});
afterAll(async()=>{await db?.close();});
async function asUser<T>(user:string,fn:()=>Promise<T>):Promise<T>{
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user]);await db.exec("set role authenticated");
  try{return await fn();}finally{await db.exec("reset role");}
}
async function command(input:unknown,user=admin,organization=org){return asUser(user,()=>db.query("select public.execute_command($1,$2::jsonb)",[organization,JSON.stringify(input)]));}
async function project(organization=org,user=admin){await command({type:"project.create",name:"Obra de prueba",client_name:"Cliente ficticio",location:"A Coruña",kind:"integral"},user,organization);return (await db.query<{id:string}>("select id from projects where organization_id=$1 order by created_at desc",[organization])).rows[0].id;}
async function budget(){const projectId=await project();await command({type:"budget.create",project_id:projectId,title:"Reforma"});const v=(await db.query<{id:string;budget_id:string}>("select id,budget_id from budget_versions")).rows[0];return {projectId,versionId:v.id,budgetId:v.budget_id};}
async function approved(){const data=await budget();await command({type:"budget.save",version_id:data.versionId,expected_revision:0,items:[firstItem],notes:"Condiciones"});await command({type:"budget.issue",version_id:data.versionId,expected_revision:1});await command({type:"budget.approve",version_id:data.versionId,reference:"Aceptación de prueba"});return data;}

describe("RLS y autorización real en PostgreSQL",()=>{
  it("solo permite leer proyectos de la propia organización",async()=>{
    await project();await project(otherOrg,outsider);
    const rows=await asUser(admin,()=>db.query<{organization_id:string}>("select organization_id from projects"));expect(rows.rows).toEqual([{organization_id:org}]);
  });
  it("no permite que un usuario se asigne el rol de administrador",async()=>{
    await expect(asUser(site,()=>db.query("update organization_members set role='admin' where user_id=$1",[site]))).rejects.toThrow(/permission denied/);
  });
  it("impide escrituras directas incluso a miembros administradores",async()=>{
    await project();await expect(asUser(admin,()=>db.query("update projects set name='Manipulado'"))).rejects.toThrow(/permission denied/);
  });
  it("rechaza comandos de otra organización y de usuarios sin identidad",async()=>{
    await expect(command({type:"project.create",name:"Ataque",client_name:"X",kind:"integral"},outsider,org)).rejects.toThrow(/permiso/);
    await expect(command({type:"project.create",name:"Ataque",client_name:"X",kind:"integral"},demoId(999),org)).rejects.toThrow(/permiso/);
  });
  it("no permite a consulta escribir ni al equipo modificar presupuestos",async()=>{
    const p=await project();await expect(command({type:"budget.create",project_id:p,title:"X"},site)).rejects.toThrow(/permiso/);
    await expect(command({type:"message.send",project_id:p,body:"X"},viewer)).rejects.toThrow(/permiso/);
  });
  it("no permite al jefe de obra aprobar una revisión",async()=>{
    const {versionId}=await approved();await expect(command({type:"budget.approve",version_id:versionId,reference:"X"},manager)).rejects.toThrow(/administración/);
  });
  it("registra la identidad del servidor, ignorando autor y organización enviados",async()=>{
    const p=await project();await command({type:"message.send",project_id:p,body:"Visita",author_name:"Administrador falso",organization_id:otherOrg},site);
    expect((await db.query("select author_name,organization_id from messages")).rows[0]).toEqual({author_name:"Usuario site",organization_id:org});
  });
  it("no deja adjuntar ni leer archivos de otra organización",async()=>{
    const p=await project(otherOrg,outsider),path=`${otherOrg}/${p}/${demoId(700)}`;
    await expect(asUser(admin,()=>db.query("insert into storage.objects(bucket_id,name) values('project-files',$1)",[path]))).rejects.toThrow(/row-level security/);
    await asUser(outsider,()=>db.query("insert into storage.objects(bucket_id,name) values('project-files',$1)",[path]));
    expect((await asUser(admin,()=>db.query("select * from storage.objects"))).rows).toHaveLength(0);
  });
  it("conserva originales de archivos y prohíbe subirlos a perfiles de consulta",async()=>{
    const p=await project(),path=`${org}/${p}/${demoId(700)}`;
    await expect(asUser(viewer,()=>db.query("insert into storage.objects(bucket_id,name) values('project-files',$1)",[path]))).rejects.toThrow(/row-level security/);
    await asUser(site,()=>db.query("insert into storage.objects(bucket_id,name) values('project-files',$1)",[path]));
    const deleted=await asUser(admin,()=>db.query("delete from storage.objects returning id"));expect(deleted.rows).toHaveLength(0);
  });
});
describe("Comandos transaccionales de presupuesto",()=>{
  it("reintenta una solicitud sin duplicar datos ni auditoría",async()=>{
    const input={type:"project.create",name:"Obra",client_name:"Cliente",kind:"integral"},key=demoId(777);
    const run=(command:unknown)=>asUser(admin,()=>db.query("select public.execute_command($1,$2::jsonb,$3)",[org,JSON.stringify(command),key]));
    await run(input);await run(input);
    expect((await db.query("select id from projects")).rows).toHaveLength(1);expect((await db.query("select id from activities")).rows).toHaveLength(1);
    await expect(run({...input,name:"Otro proyecto"})).rejects.toThrow(/otra operación/);
  });
  it("genera números de proyecto distintos y no deja filas parciales ante un error",async()=>{
    await project();await project();expect((await db.query("select code from projects order by code")).rows).toEqual([{code:"PL-001"},{code:"PL-002"}]);
    await expect(command({type:"project.create",name:"",client_name:"X",kind:"integral"})).rejects.toThrow();
    expect((await db.query<{project_counter:number}>("select project_counter from organizations where id=$1",[org])).rows[0].project_counter).toBe(2);
  });
  it("rechaza partidas duplicadas, nulas, fuera de rango o con demasiados decimales",async()=>{
    const {versionId}=await budget();
    for(const items of [[firstItem,firstItem],[{...firstItem,id:null}],[{...firstItem,unit:null}],[{...firstItem,quantity:0.0001}],[{...firstItem,unit_price:-1}]]) {
      await expect(command({type:"budget.save",version_id:versionId,expected_revision:0,items,notes:""})).rejects.toThrow(/válidas/);
    }
  });
  it("coincide con el cálculo decimal de TypeScript",async()=>{
    for(const item of [firstItem,{...firstItem,quantity:1.005,unit_price:100,adjustment_percent:0},{...firstItem,quantity:1000000,unit_price:100000000,adjustment_percent:99.99}]) {
      const result=await db.query<{amount:number}>("select private.budget_base($1::jsonb) as amount",[JSON.stringify([item])]);expect(Number(result.rows[0].amount)).toBe(lineTotal(item));
    }
  });
  it("rechaza un guardado obsoleto y conserva el primero",async()=>{
    const {versionId}=await budget(),input={type:"budget.save",version_id:versionId,expected_revision:0,items:[firstItem],notes:"Primero"};await command(input);
    await expect(command({...input,notes:"Segundo"})).rejects.toThrow(/Otra persona/);
    expect((await db.query("select notes,draft_revision from budget_versions")).rows[0]).toEqual({notes:"Primero",draft_revision:1});
  });
  it("la revisión aprobada es inmutable tanto por RPC como por escritura administrativa",async()=>{
    const {versionId}=await approved();
    await expect(command({type:"budget.save",version_id:versionId,expected_revision:1,items:[],notes:"Cambiar"})).rejects.toThrow(/cerrada/);
    await expect(db.query("update budget_versions set notes='Cambiar' where id=$1",[versionId])).rejects.toThrow(/contenido original/);
    await expect(db.query("update budget_versions set status='draft' where id=$1",[versionId])).rejects.toThrow(/Transición/);
  });
  it("conserva la aprobación vigente mientras se prepara la siguiente revisión",async()=>{
    const {versionId,budgetId}=await approved();await command({type:"budget.revise",version_id:versionId,reason:"Cambio solicitado"});
    expect((await db.query("select approved_version_id from budgets where id=$1",[budgetId])).rows[0]).toEqual({approved_version_id:versionId});
    await expect(command({type:"budget.revise",version_id:versionId,reason:"Duplicado"})).rejects.toThrow(/borrador/);
    const rows=(await db.query<{items:BudgetItem[];number:number}>("select items,number from budget_versions order by number")).rows;
    expect(rows[1].number).toBe(2);expect(rows[1].items).toEqual(rows[0].items);
  });
  it("conserva la aprobación anterior al aprobar una revisión nueva y audita ambas",async()=>{
    const {versionId}=await approved();await command({type:"budget.revise",version_id:versionId,reason:"Cambio solicitado"});
    const next=(await db.query<{id:string}>("select id from budget_versions where number=2")).rows[0].id;
    await command({type:"budget.issue",version_id:next,expected_revision:0});await command({type:"budget.approve",version_id:next,reference:"Segunda aceptación"});
    expect((await db.query("select status,approval_reference from budget_versions order by number")).rows).toEqual([{status:"superseded",approval_reference:"Aceptación de prueba"},{status:"approved",approval_reference:"Segunda aceptación"}]);
    expect((await db.query("select * from activities where command_type='budget.approve'")).rows).toHaveLength(2);
  });
  it("no usa alternativas en la base certificable ni permite sumar por encima de ella",async()=>{
    const {projectId,versionId}=await approved();const base=lineTotal(firstItem);
    const c={type:"certification.create",project_id:projectId,budget_version_id:versionId,title:"Tramo",amount:base};await command(c);
    await expect(command({...c,amount:1})).rejects.toThrow(/saldo/);
    await command({type:"budget.revise",version_id:versionId,reason:"Reducir"});
    const next=(await db.query<{id:string}>("select id from budget_versions where number=2")).rows[0].id;
    await command({type:"budget.save",version_id:next,expected_revision:0,items:[{...firstItem,quantity:1}],notes:""});await command({type:"budget.issue",version_id:next,expected_revision:1});
    await expect(command({type:"budget.approve",version_id:next,reference:"Reducir"})).rejects.toThrow(/inferior/);
  });
  it("no permite registrar documentos inexistentes o con metadatos inventados",async()=>{
    const projectId=await project(),path=`${org}/${projectId}/${demoId(700)}`;
    const c={type:"document.add",project_id:projectId,name:"Plano.pdf",category:"plan",storage_path:path,mime_type:"application/pdf",size_bytes:1000};
    await expect(command(c)).rejects.toThrow(/subido/);
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('project-files',$1,$2)",[path,JSON.stringify({size:1000,mimetype:"application/pdf"})]);
    await expect(command({...c,size_bytes:2000})).rejects.toThrow(/metadatos/);await command(c);
    expect((await db.query("select * from documents")).rows).toHaveLength(1);
  });
});

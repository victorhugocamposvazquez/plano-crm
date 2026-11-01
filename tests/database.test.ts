import { PGlite } from "@electric-sql/pglite";
import { readFileSync,readdirSync } from "node:fs";
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
  // Todas las migraciones, en orden, igual que `supabase db push`.
  for(const file of readdirSync(new URL("../supabase/migrations/",import.meta.url)).sort()) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
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
  it("numera las facturas al enviarlas, sin huecos, y protege las enviadas",async()=>{
    const projectId=await project();const due="2099-01-01";
    const id=async()=>(await db.query<{id:string}>("select id from invoices order by created_at desc,id limit 1")).rows[0].id;
    await command({type:"invoice.create",project_id:projectId,concept:"Primera",base:10000,vat_rate:21});const primera=await id();
    expect((await db.query("select number,status,tax,total,client_name from invoices where id=$1",[primera])).rows[0]).toEqual({number:null,status:"draft",tax:2100,total:12100,client_name:"Cliente ficticio"});
    await command({type:"invoice.update",id:primera,base:20000,vat_rate:10});
    expect((await db.query("select tax,total from invoices where id=$1",[primera])).rows[0]).toEqual({tax:2000,total:22000});
    await command({type:"invoice.create",project_id:projectId,concept:"Descartada",base:500,vat_rate:21});await command({type:"invoice.delete",id:await id()});
    await command({type:"invoice.send",id:primera,due_date:due});
    await command({type:"invoice.create",project_id:projectId,concept:"Segunda",base:100,vat_rate:21});const segunda=(await db.query<{id:string}>("select id from invoices where concept='Segunda'")).rows[0].id;await command({type:"invoice.send",id:segunda,due_date:due});
    const year=new Date().getFullYear();
    expect((await db.query("select number from invoices order by number_seq")).rows).toEqual([{number:`${year}-0001`},{number:`${year}-0002`}]);
    await expect(command({type:"invoice.delete",id:primera})).rejects.toThrow(/no se borra/);
    await expect(command({type:"invoice.update",id:primera,concept:"Otro"})).rejects.toThrow(/no se edita/);
    await expect(command({type:"invoice.send",id:primera,due_date:due})).rejects.toThrow(/ya está enviada/);
    await command({type:"invoice.pay",id:primera,paid_on:"2026-10-31"});await command({type:"invoice.unpay",id:primera});
    expect((await db.query("select status,paid_on from invoices where id=$1",[primera])).rows[0]).toEqual({status:"sent",paid_on:null});
  });
  it("una factura sale una sola vez de un cobro y con su importe",async()=>{
    const {projectId,versionId}=await approved();const base=lineTotal(firstItem);
    await command({type:"certification.create",project_id:projectId,budget_version_id:versionId,title:"Tramo",amount:base});const cert=(await db.query<{id:string}>("select id from certifications")).rows[0].id;
    await command({type:"invoice.create",project_id:projectId,concept:"Tramo",base:1,vat_rate:21,certification_id:cert});
    expect((await db.query<{base:unknown}>("select base from invoices")).rows[0].base).toBe(base);
    await expect(command({type:"invoice.create",project_id:projectId,concept:"Otra",base:1,vat_rate:21,certification_id:cert})).rejects.toThrow(/ya tiene factura/);
  });
  it("solo oficina o administración tocan facturas y cada empresa ve las suyas",async()=>{
    const projectId=await project();const c={type:"invoice.create",project_id:projectId,concept:"Prueba",base:100,vat_rate:21};
    await expect(command(c,manager)).rejects.toThrow(/administración/);await expect(command(c,site)).rejects.toThrow(/permiso/);await expect(command(c,viewer)).rejects.toThrow(/permiso/);
    await command(c);
    expect((await asUser(viewer,()=>db.query("select id from invoices"))).rows).toHaveLength(1);
    expect((await asUser(outsider,()=>db.query("select id from invoices"))).rows).toHaveLength(0);
    await expect(asUser(admin,()=>db.query("delete from invoices"))).rejects.toThrow(/permission|permiso/);
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

describe("Editar y borrar mensajes en PostgreSQL",()=>{
  async function mensaje(user=site){const p=await project();await command({type:"message.send",project_id:p,body:"Hola equipo"},user);return (await db.query<{id:string}>("select id from messages")).rows[0].id;}
  it("el autor edita el suyo y queda marcado; otra persona no puede",async()=>{
    const id=await mensaje();
    await command({type:"message.edit",id,body:"Hola a todos"},site);
    expect((await db.query<{body:string;edited:boolean}>("select body, edited_at is not null as edited from messages")).rows[0]).toEqual({body:"Hola a todos",edited:true});
    await expect(command({type:"message.edit",id,body:"X"},manager)).rejects.toThrow(/escribió/);
  });
  it("administración borra el de otro con borrado lógico; el jefe de obra no",async()=>{
    const id=await mensaje();
    await expect(command({type:"message.delete",id},manager)).rejects.toThrow(/borrarlo/);
    await command({type:"message.delete",id},admin);
    expect((await db.query<{body:string;deleted:boolean}>("select body, deleted_at is not null as deleted from messages")).rows[0]).toEqual({body:"",deleted:true});
    await expect(command({type:"message.edit",id,body:"X"},site)).rejects.toThrow(/no encontrado/);
  });
  it("consulta no puede editar ni borrar",async()=>{
    const id=await mensaje();
    await expect(command({type:"message.delete",id},viewer)).rejects.toThrow(/permiso/);
  });
});

describe("Reacciones en PostgreSQL",()=>{
  it("añade, acumula y quita reacciones por persona",async()=>{
    const p=await project();await command({type:"message.send",project_id:p,body:"Hola"},site);
    const id=(await db.query<{id:string}>("select id from messages")).rows[0].id;
    await command({type:"message.react",id,emoji:"👍"},site);
    await command({type:"message.react",id,emoji:"👍"},admin);
    expect((await db.query<{reactions:Record<string,string[]>}>("select reactions from messages")).rows[0].reactions).toEqual({"👍":["Usuario site","Usuario admin"]});
    await command({type:"message.react",id,emoji:"👍"},site);
    await command({type:"message.react",id,emoji:"👍"},admin);
    expect((await db.query<{reactions:Record<string,string[]>}>("select reactions from messages")).rows[0].reactions).toEqual({});
    await expect(command({type:"message.react",id,emoji:"🦄"},admin)).rejects.toThrow(/no admitida/);
  });
});

describe("Editar y eliminar artículos del catálogo en PostgreSQL",()=>{
  async function articulo(){await command({type:"article.create",code:"PIN-001",name:"Pintura plástica",chapter:"Pintura",unit:"m²",unit_price:1450,vat_rate:21});return (await db.query<{id:string}>("select id from articles")).rows[0].id;}
  it("cambia solo los campos enviados, no repite referencia y respeta los límites",async()=>{
    const id=await articulo();
    await command({type:"article.create",code:"PIN-002",name:"Esmalte",chapter:"Pintura",unit:"m²",unit_price:2000,vat_rate:21});
    await command({type:"article.update",id,chapter:"Acabados",unit_price:1600},manager);
    expect((await db.query<{code:string;name:string;chapter:string;unit_price:number}>("select code,name,chapter,unit_price::int from articles where id=$1",[id])).rows[0]).toEqual({code:"PIN-001",name:"Pintura plástica",chapter:"Acabados",unit_price:1600});
    await expect(command({type:"article.update",id,code:"pin-002"},manager)).rejects.toThrow(/referencia/);
    await expect(command({type:"article.update",id,unit_price:-1},manager)).rejects.toThrow(/unit_price/);
    await expect(command({type:"article.update",id,name:"X"},site)).rejects.toThrow(/permiso/);
    await expect(command({type:"article.update",id:demoId(999),name:"X"},admin)).rejects.toThrow(/no encontrado/);
  });
  it("elimina el artículo y deja actividad",async()=>{
    const id=await articulo();
    await expect(command({type:"article.delete",id},site)).rejects.toThrow(/permiso/);
    await command({type:"article.delete",id},admin);
    expect((await db.query("select id from articles")).rows).toHaveLength(0);
    expect((await db.query<{text:string}>("select text from activities order by created_at desc limit 1")).rows[0].text).toMatch(/Artículo eliminado/);
  });
});

describe("Editar y eliminar tareas en PostgreSQL",()=>{
  async function tarea(){const p=await project();await command({type:"task.create",project_id:p,title:"Replantear",trade:"Albañilería",assignee:"",due_date:"2026-11-02",weight:20});return (await db.query<{id:string}>("select id from tasks")).rows[0].id;}
  it("cambia solo los campos enviados y respeta los límites",async()=>{
    const id=await tarea();
    await command({type:"task.update",id,due_date:"2026-11-09",assignee:"Dani"},manager);
    expect((await db.query<{title:string;assignee:string;due:string;weight:number}>("select title,assignee,to_char(due_date,'YYYY-MM-DD') as due,weight from tasks")).rows[0]).toEqual({title:"Replantear",assignee:"Dani",due:"2026-11-09",weight:20});
    await expect(command({type:"task.update",id,weight:0},manager)).rejects.toThrow(/weight/);
    await expect(command({type:"task.update",id,title:"X"},site)).rejects.toThrow(/permiso/);
  });
  it("elimina la tarea y deja actividad",async()=>{
    const id=await tarea();
    await expect(command({type:"task.delete",id},site)).rejects.toThrow(/permiso/);
    await command({type:"task.delete",id},admin);
    expect((await db.query("select id from tasks")).rows).toHaveLength(0);
    expect((await db.query<{text:string}>("select text from activities order by created_at desc limit 1")).rows[0].text).toMatch(/Tarea eliminada/);
  });
});

describe("Fechas verificables de las ediciones de partidas",()=>{
  it("conserva altas, modificaciones y bajas con fecha y autor del servidor",async()=>{
    const {versionId}=await budget();
    await command({type:"budget.save",version_id:versionId,expected_revision:0,items:[firstItem],notes:"",occurred_at:"1900-01-01",actor_name:"Falso"});
    await command({type:"budget.save",version_id:versionId,expected_revision:1,items:[{...firstItem,quantity:20}],notes:""},manager);
    await command({type:"budget.save",version_id:versionId,expected_revision:2,items:[],notes:""});
    const events=(await db.query<{kind:string;fields:string[];occurred_at:Date;actor_name:string;before_item:BudgetItem|null;after_item:BudgetItem|null}>("select * from budget_item_events order by draft_revision")).rows;
    expect(events.map(e=>e.kind)).toEqual(["added","changed","removed"]);
    expect(events[1].fields).toEqual(["quantity"]);expect(events[1].actor_name).toBe("Usuario manager");
    expect(events[0].actor_name).toBe("Usuario admin");expect(new Date(events[0].occurred_at).getUTCFullYear()).toBeGreaterThan(2025);
    expect(events[1].before_item?.quantity).toBe(firstItem.quantity);expect(events[1].after_item?.quantity).toBe(20);
    const latest=await asUser(viewer,()=>db.query("select * from budget_item_change_dates($1)",[versionId]));
    expect(latest.rows).toHaveLength(1);expect(latest.rows[0]).toMatchObject({kind:"removed",draft_revision:3});
    const snapshot=await asUser(viewer,()=>db.query("select * from budget_item_change_dates($1,2)",[versionId]));
    expect(snapshot.rows[0]).toMatchObject({kind:"changed",draft_revision:2});
  });
  it("no fecha como edición copiar una versión, reordenar o guardar solo condiciones",async()=>{
    const {versionId}=await approved();
    const count=async()=>Number((await db.query<{n:string}>("select count(*) as n from budget_item_events")).rows[0].n);
    const initial=await count();await command({type:"budget.revise",version_id:versionId,reason:"Revisión"});
    const next=(await db.query<{id:string}>("select id from budget_versions where status='draft'")).rows[0].id;
    await command({type:"budget.save",version_id:next,expected_revision:0,items:[firstItem],notes:"Condiciones diferentes"});
    expect(await count()).toBe(initial);
    const extra={...firstItem,id:demoId(101)};
    await command({type:"budget.save",version_id:next,expected_revision:1,items:[firstItem,extra],notes:""});
    await command({type:"budget.save",version_id:next,expected_revision:2,items:[extra,firstItem],notes:""});
    expect(await count()).toBe(initial+1);
  });
  it("rechaza manipular el registro y no permite leerlo desde otra organización",async()=>{
    const {versionId}=await approved();
    expect((await asUser(outsider,()=>db.query("select * from budget_item_change_dates($1)",[versionId]))).rows).toHaveLength(0);
    await expect(asUser(admin,()=>db.exec("update budget_item_events set actor_name='Falso'"))).rejects.toThrow(/permission denied/);
    await expect(asUser(admin,()=>db.exec("delete from budget_item_events"))).rejects.toThrow(/permission denied/);
    await expect(asUser(admin,()=>db.exec("insert into budget_item_events default values"))).rejects.toThrow(/permission denied/);
  });
  it("los reintentos, conflictos y cambios rechazados no producen fechas nuevas",async()=>{
    const {versionId}=await budget(),key=demoId(888);
    const input={type:"budget.save",version_id:versionId,expected_revision:0,items:[firstItem],notes:""};
    const run=()=>asUser(admin,()=>db.query("select public.execute_command($1,$2::jsonb,$3)",[org,JSON.stringify(input),key]));
    await run();await run();
    await expect(command({...input,items:[{...firstItem,quantity:30}]})).rejects.toThrow(/actualizado/);
    expect((await db.query("select * from budget_item_events")).rows).toHaveLength(1);
    await command({type:"budget.issue",version_id:versionId,expected_revision:1});
    await command({type:"budget.approve",version_id:versionId,reference:"Aceptación"});
    await expect(command({...input,expected_revision:1,items:[]})).rejects.toThrow();
    expect((await db.query("select * from budget_item_events")).rows).toHaveLength(1);
  });
});

describe("Capturas y procedencia de partidas en PostgreSQL",()=>{
  async function fixture(){
    const data=await budget();await command({type:"article.create",code:"CAP",name:"Paredes medidas",chapter:"Pintura",unit:"m²",unit_price:1000,vat_rate:21});
    const article=(await db.query<{id:string}>("select id from articles where code='CAP'")).rows[0].id;
    const survey={schema_version:1,project_id:data.projectId,scope:"Pintar una zona",calibrations:[],sources:[{id:demoId(801),kind:"manual",label:"Medidas anotadas",phase:"existing",legend:""}],rooms:[{id:demoId(802),label:"Zona",scope:"Pintura",source_ids:[demoId(801)],observations:[],questions:[],measurements:[{id:demoId(803),source_id:demoId(801),kind:"quantity",label:"Paredes",value:12.5,unit:"m²",method:"manual",reference:"Medida anotada"}],selections:[{kind:"work",intent:{id:demoId(804),label:"Pintura",article_id:article,formula:{kind:"sum",measurement_ids:[demoId(803)]},inclusion:"included",adjustment_percent:0,adjustment_reason:""}}]}]};
    const items=[{...firstItem,id:demoId(804),chapter:"Pintura",description:"Paredes medidas",quantity:12.5,unit_price:1000,adjustment_percent:0}];
    return {...data,survey,items};
  }
  const save=(projectId:string,survey:unknown,revision=0,user=admin)=>asUser(user,()=>db.query<{capture:{revision:number;updated_by_name:string}}>("select save_room_capture($1,$2,$3,$4::jsonb) as capture",[org,projectId,revision,JSON.stringify(survey)]));
  const apply=(f:Awaited<ReturnType<typeof fixture>>,revision=0,captureRevision=1,items=f.items,user=admin)=>asUser(user,()=>db.query("select apply_room_capture($1,$2,$3,$4,$5,$6::jsonb,true) as snapshot",[org,f.projectId,captureRevision,f.versionId,revision,JSON.stringify(items)]));
  it("retoma una captura, conserva autor del servidor y detecta conflictos",async()=>{
    const f=await fixture();const first=await save(f.projectId,f.survey);expect(first.rows[0].capture).toMatchObject({revision:1,updated_by_name:"Usuario admin"});
    expect((await save(f.projectId,f.survey)).rows[0]).toEqual(first.rows[0]);
    await expect(save(f.projectId,{...f.survey,scope:"Otra cosa"})).rejects.toThrow(/actualizado/);
    expect((await save(f.projectId,{...f.survey,scope:"Otra cosa"},1)).rows[0].capture).toMatchObject({revision:2});
  });
  it("solo admite responsables de presupuesto y bloquea lectura y documentos de otra empresa",async()=>{
    const f=await fixture();await expect(save(f.projectId,f.survey,0,site)).rejects.toThrow(/permiso/);await save(f.projectId,f.survey);
    expect((await asUser(outsider,()=>db.query("select * from room_captures"))).rows).toHaveLength(0);
    await expect(asUser(admin,()=>db.exec("delete from room_capture_imports"))).rejects.toThrow(/permission denied/);
    const foreign=await project(otherOrg,outsider);
    const doc=(await db.query<{id:string}>("insert into documents(organization_id,project_id,name,category,storage_path,mime_type,size_bytes) values($1,$2,'Foto','before',$3,'image/jpeg',100) returning id",[otherOrg,foreign,`${otherOrg}/${foreign}/${demoId(900)}`])).rows[0].id;
    await expect(save(f.projectId,{...f.survey,sources:[{...f.survey.sources[0],kind:"photo",document_id:doc}]},1)).rejects.toThrow(/otro proyecto/);
  });
  it("incorpora presupuesto y procedencia juntos, y reintentar no duplica",async()=>{
    const f=await fixture();await save(f.projectId,f.survey);await apply(f);await apply(f);
    expect((await db.query("select * from room_capture_imports")).rows).toHaveLength(1);
    expect((await db.query<{items:BudgetItem[];draft_revision:number}>("select items,draft_revision from budget_versions where id=$1",[f.versionId])).rows[0]).toMatchObject({items:f.items,draft_revision:1});
    expect((await db.query("select * from budget_item_events")).rows).toHaveLength(1);
    await save(f.projectId,{...f.survey,scope:"Cambiar alcance"},1);
    expect((await db.query<{survey:typeof f.survey}>("select survey from room_capture_imports")).rows[0].survey.scope).toBe("Pintar una zona");
  });
  it("no permite cantidades ni precios inyectados, tampoco al llamar directamente al RPC",async()=>{
    const f=await fixture();await save(f.projectId,f.survey);
    await expect(apply(f,0,1,[{...f.items[0],quantity:99}])).rejects.toThrow(/cantidad no coincide/);
    await expect(apply(f,0,1,[{...f.items[0],unit_price:1}])).rejects.toThrow(/catálogo/);
    expect((await db.query("select * from room_capture_imports")).rows).toHaveLength(0);
    expect((await db.query<{items:BudgetItem[]}>("select items from budget_versions where id=$1",[f.versionId])).rows[0].items).toEqual([]);
  });
  it("requiere motivo del ajuste también al llamar directamente al RPC",async()=>{
    const f=await fixture();f.survey.rooms[0].selections[0].intent.adjustment_percent=15;
    await save(f.projectId,f.survey);
    await expect(apply(f,0,1,[{...f.items[0],adjustment_percent:15}])).rejects.toThrow(/motivo del ajuste/);
    expect((await db.query("select * from room_capture_imports")).rows).toHaveLength(0);
  });
  it("actualiza una importada intacta y protege una edición manual posterior",async()=>{
    const f=await fixture();await save(f.projectId,f.survey);await apply(f);
    const changed=structuredClone(f.survey);changed.rooms[0].measurements[0].value=20;
    await save(f.projectId,changed,1);await apply(f,1,2,[{...f.items[0],quantity:20}]);
    await command({type:"budget.save",version_id:f.versionId,expected_revision:2,items:[{...f.items[0],quantity:25}],notes:"Edición manual"});
    changed.rooms[0].measurements[0].value=30;await save(f.projectId,changed,2);
    await expect(apply(f,3,3,[{...f.items[0],quantity:30}])).rejects.toThrow(/ya se ha editado/);
    expect((await db.query("select * from room_capture_imports")).rows).toHaveLength(2);
  });
  it("nunca aplica sobre una versión aprobada ni sobre un guardado obsoleto",async()=>{
    const f=await fixture();await save(f.projectId,f.survey);
    await expect(apply(f,1)).rejects.toThrow(/presupuesto ha cambiado/);
    await apply(f);await command({type:"budget.issue",version_id:f.versionId,expected_revision:1});await command({type:"budget.approve",version_id:f.versionId,reference:"Prueba"});
    await expect(apply(f,1)).rejects.toThrow(/borrador abierto/);
  });
});

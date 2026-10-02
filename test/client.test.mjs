// Hatter downstream 2026: exact Scene relations survive both presentation modes.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {produce,scene} from '@hathq/projection-contracts'
import {ClientProjectionRuntime,renderPlan,projectionIdentity} from '../src/index.mjs'

const source={owner:'example',ref:'subject',revision:'source:one',kind:'subject'}
function snapshot(value='one',ids=['a','b'],key='profile',actions=true,temporal=false){
  const request={key:'data:'+key,producer:{id:'test',version:'0.10.0',contract:'projection/0.10.0',configuration:'fixed'},
    sources:[source],focus:'subject',purpose:'profile',visibilityRef:'test',limits:{}}
  const data=produce(request,[{source,items:ids.map(id=>({id,semanticRef:null,group:{kind:'structural',ref:'source'},
    value,evidence:['evidence'],provenance:['packet'],resolutionRefs:[],visibility:'visible'})),
    relations:ids.includes('a')&&ids.includes('b')?[{id:'a/b',from:'a',to:'b',relationRef:'relation:declared'}]:[],unresolved:[],truncated:false}])
  return scene(data,{key,focus:'subject',purpose:'profile',regions:[{id:'primary',role:'Primary',itemIds:ids}],
    actions:actions?[{id:'review',targetOwner:'example',commandRef:'review',contextRefs:[],sourceRefs:[source],label:'Review'}]:[],
    ...(temporal?{temporal:{label:'Declared time',items:ids.map(itemId=>({itemId,valuePath:['at'],format:'utcInstant'}))}}:{})})
}
const throws=(f,code)=>assert.throws(f,e=>e.code===code)
test('exact SSR adoption, immutable snapshots, deterministic presentation and stale-action rebase',()=>{
  const p1=snapshot(), p2=snapshot('two',['b']), runtime=new ClientProjectionRuntime()
  runtime.adopt(p1,{kind:'hydrate',expected:projectionIdentity(p1)})
  assert.deepEqual(runtime.projection,p1);assert.ok(Object.isFrozen(runtime.projection.data.items))
  const handle=runtime.action('review')
  runtime.present({focus:'a',selectedItems:['a','b'],expandedItems:['a','b'],activeRegion:'primary',inspector:'a'})
  const plan=renderPlan(runtime.projection,runtime.presentation)
  assert.deepEqual(plan,renderPlan(runtime.projection,runtime.presentation));assert.equal(plan.regions[0].items[0].selected,true)
  const intent=runtime.intent(handle);assert.deepEqual(intent.ownerCommandDescriptor,p1.data.actions[0])
  assert.deepEqual(runtime.projection,p1)
  runtime.adopt(p2,{kind:'current',expectedCurrent:p1.revision})
  assert.equal(runtime.presentation.focus,null);assert.deepEqual(runtime.presentation.selectedItems,['b'])
  assert.deepEqual(runtime.presentation.expandedItems,['b']);assert.equal(runtime.presentation.inspector,null)
  throws(()=>runtime.intent(handle),'StaleSceneAction')
  throws(()=>runtime.adopt(p1,{kind:'current',expectedCurrent:p1.revision}),'StaleProjectionDelivery')
  assert.deepEqual(runtime.projection,p2)
  for(let i=0;i<20;i++)runtime.adopt(snapshot(String(i)),{kind:'current',expectedCurrent:runtime.projection.revision})
  assert.deepEqual(runtime.inspect(),{keys:1,snapshots:2,closed:false})
  runtime.close();throws(()=>runtime.present({focus:'b'}),'ClientRuntimeClosed')
  throws(()=>runtime.intent(handle),'ClientRuntimeClosed')
})
test('one Scene drives spatial/list views, exact relations and inspector; selection never changes authority',()=>{
  const runtime=new ClientProjectionRuntime(),first=snapshot('exact-value')
  runtime.adopt(first,{kind:'current',expectedCurrent:null})
  assert.equal(runtime.presentation.viewMode,'spatial')
  runtime.present({selectedItems:['a'],focus:'a',inspector:'b'})
  const spatial=renderPlan(runtime.projection,runtime.presentation)
  assert.equal(spatial.viewMode,'spatial')
  assert.deepEqual(spatial.relations,[{...first.data.relations[0],active:true}])
  assert.equal(spatial.regions[0].items.find(i=>i.id==='b').related,true)
  assert.deepEqual(spatial.inspector,first.data.items.find(i=>i.id==='b'))
  runtime.present({viewMode:'structured'})
  const structured=renderPlan(runtime.projection,runtime.presentation)
  assert.deepEqual({...structured,viewMode:'spatial'},spatial)
  assert.deepEqual(runtime.projection,first)
  throws(()=>runtime.present({viewMode:'remote'}),'InvalidPresentationTarget')
  const second=snapshot('changed',['b'])
  runtime.adopt(second,{kind:'current',expectedCurrent:first.revision})
  const next=renderPlan(runtime.projection,runtime.presentation)
  assert.equal(next.viewMode,'structured');assert.deepEqual(next.relations,[])
  assert.equal(next.regions[0].items[0].related,false)
  runtime.present({inspector:null});assert.equal(renderPlan(runtime.projection,runtime.presentation).inspector,null)
  const timed=snapshot({at:'2026-09-16T09:00:00.000Z'},['b'],'profile',true,true)
  runtime.adopt(timed,{kind:'current',expectedCurrent:second.revision})
  runtime.present({camera:{x:.5,y:-.5,z:1.2},timeCursor:'b'})
  assert.deepEqual(renderPlan(runtime.projection,runtime.presentation).camera,{x:.5,y:-.5,z:1.2})
  assert.equal(renderPlan(runtime.projection,runtime.presentation).temporal.cursor,'b')
  assert.deepEqual(runtime.projection,timed,'camera and temporal focus never alter source or action identity')
  for(const camera of [{x:NaN,y:0,z:1},{x:2,y:0,z:1},{x:0,y:0,z:0},{x:0,y:0,z:2}])throws(()=>runtime.present({camera}),'InvalidPresentationTarget')
  throws(()=>runtime.present({camera:{x:0,y:0,z:1,authority:true}}),'InvalidProjection')
  throws(()=>runtime.present({timeCursor:'absent'}),'InvalidPresentationTarget')
  const untimed=snapshot('changed',['b'])
  runtime.adopt(untimed,{kind:'current',expectedCurrent:timed.revision})
  assert.equal(runtime.presentation.timeCursor,null)
  assert.equal(renderPlan(runtime.projection,runtime.presentation).temporal,null)
  assert.equal(runtime.presentation.camera.z,1.2)
  runtime.close()
})
test('mismatch/corruption/oversize/unknown renderer fail closed; explicit recovery only',()=>{
  const p1=snapshot(),p2=snapshot('two'),runtime=new ClientProjectionRuntime()
  throws(()=>runtime.adopt(p2,{kind:'hydrate',expected:projectionIdentity(p1)}),'HydrationProjectionMismatch')
  assert.equal(runtime.projection,null)
  runtime.adopt(p2,{kind:'current',expectedCurrent:null})
  throws(()=>runtime.adopt({...p2,key:'other'},{kind:'current',expectedCurrent:null}),'InvalidProjection')
  throws(()=>runtime.adopt({...p2,lineage:{...p2.lineage,sources:[]}},{kind:'current',expectedCurrent:p2.revision}),'InvalidProjection')
  throws(()=>runtime.adopt({...p2,data:{...p2.data,items:[]}},{kind:'current',expectedCurrent:p2.revision}),'InvalidProjection')
  throws(()=>runtime.adopt({...p2,extra:'x'.repeat(600000)},{kind:'current',expectedCurrent:p2.revision}),'ProjectionLimitExceeded')
  throws(()=>renderPlan(p2,runtime.presentation,{roles:[]}),'UnsupportedRenderer')
  throws(()=>runtime.present({focus:'invented'}),'InvalidPresentationTarget')
  throws(()=>runtime.present({selectedItems:Array(257).fill('a')}),'PresentationLimitExceeded')
  throws(()=>runtime.present({expandedItems:Array(257).fill('a')}),'PresentationLimitExceeded')
  throws(()=>runtime.present({activeRegion:'invented'}),'InvalidPresentationTarget')
  assert.equal(runtime.projection.revision,p2.revision)
})
test('bounded navigation, focus, exact IDs, STATE ordering and teardown have no owner effects',()=>{
  const runtime=new ClientProjectionRuntime(),p1=snapshot(),p2=snapshot('two')
  runtime.input({kind:'Snapshot',revision:p1.revision,snapshot:p1},{expectedCurrent:null})
  runtime.input({kind:'NoChange',revision:p1.revision},{expectedCurrent:p1.revision})
  runtime.input({kind:'Snapshot',revision:p2.revision,snapshot:p2},{expectedCurrent:p1.revision})
  throws(()=>runtime.input({kind:'NoChange',revision:p1.revision},{expectedCurrent:p2.revision}),'StaleProjectionDelivery')
  for(let i=0;i<8;i++){
    const previous=runtime.presentation.activeScene
    runtime.adopt(snapshot('n',['a'],'scene'+i),{kind:'current',expectedCurrent:null})
    assert.equal(runtime.presentation.activeScene,previous,'background STATE cannot navigate')
    runtime.navigate('scene'+i)
  }
  assert.equal(runtime.inspect().keys,8)
  for(let i=0;i<70;i++)runtime.navigate('scene'+(i%8))
  assert.equal(runtime.presentation.navigation.length,64)
  const active=runtime.presentation.activeScene;runtime.back();assert.notEqual(runtime.presentation.activeScene,active)
  runtime.forward();assert.equal(runtime.presentation.activeScene,active)
  throws(()=>runtime.navigate('missing'),'SceneUnavailable')
  runtime.close();assert.deepEqual(runtime.inspect(),{keys:0,snapshots:0,closed:true})
})

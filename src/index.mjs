// Hatter downstream 2026: one exact Scene, presentation-only view and relation emphasis.
import {validateSnapshot,canonical,copy,frozen,shape,text,roles,ProjectionError} from '@hathq/projection-contracts/client'

const fail=code=>{throw new ProjectionError(code)}
const check=(value,code)=>{if(!value)fail(code)}
const empty=()=>({activeScene:null,focus:null,selectedItems:[],expandedItems:[],activeRegion:null,
  navigation:[],navigationIndex:-1,inspector:null,loading:false,viewMode:'spatial',camera:{x:0,y:0,z:1},timeCursor:null})
export const projectionIdentity=s=>frozen(copy({key:s.key,revision:s.revision,lineage:s.lineage}))
function sceneSnapshot(snapshot){validateSnapshot(snapshot);check(snapshot.kind==='Scene','SceneUnavailable');return frozen(copy(snapshot))}
function targets(snapshot){return new Set([...snapshot.data.items,...snapshot.data.unresolved].map(i=>i.id))}
function rebase(previous,snapshot){
  const ids=targets(snapshot),regions=new Set(snapshot.data.regions.map(r=>r.id))
  return frozen({...previous,activeScene:snapshot.key,focus:ids.has(previous.focus)?previous.focus:null,
    selectedItems:previous.selectedItems.filter(id=>ids.has(id)),expandedItems:previous.expandedItems.filter(id=>ids.has(id)),
    activeRegion:regions.has(previous.activeRegion)?previous.activeRegion:null,inspector:ids.has(previous.inspector)?previous.inspector:null,
    timeCursor:snapshot.data.temporal?.items.some(item=>item.itemId===previous.timeCursor)?previous.timeCursor:null})
}

export class ClientProjectionRuntime {
  #cache=new Map();#presentation=frozen(empty());#closed=false
  get projection(){return this.#cache.get(this.#presentation.activeScene)?.at(-1)??null}
  get presentation(){return this.#presentation}
  #open(){check(!this.#closed,'ClientRuntimeClosed')}
  current(key){this.#open();return this.#cache.get(key)?.at(-1)??null}
  adopt(snapshot,context){
    this.#open();shape(context,['kind'],['expected','expectedCurrent'])
    const next=sceneSnapshot(snapshot),old=this.current(next.key)
    if(context.kind==='hydrate'){
      check(canonical(projectionIdentity(next))===canonical(context.expected),'HydrationProjectionMismatch')
      check(!old||old.revision===next.revision,'HydrationProjectionMismatch')
    }else{
      check(context.kind==='current'&&Object.hasOwn(context,'expectedCurrent'),'ProjectionAdoptionError')
      check((old?.revision??null)===context.expectedCurrent,'StaleProjectionDelivery')
    }
    if(!old&&this.#cache.size===8){
      const evict=[...this.#cache.keys()].find(k=>k!==this.#presentation.activeScene)
      this.#cache.delete(evict)
    }
    const versions=this.#cache.get(next.key)??[]
    const retained=versions.filter(v=>v.revision!==next.revision).slice(-1)
    this.#cache.delete(next.key);this.#cache.set(next.key,[...retained,next])
    if(this.#presentation.activeScene===next.key)this.#presentation=rebase(this.#presentation,next)
    else if(this.#presentation.activeScene===null)this.navigate(next.key)
    return next
  }
  input(input,context){
    this.#open();shape(context,['expectedCurrent']);shape(input,['kind','revision'],input?.kind==='Snapshot'?['snapshot']:[]);text(input.revision)
    if(input.kind==='Snapshot'){
      check(input.snapshot?.revision===input.revision,'ProjectionAdoptionError')
      return this.adopt(input.snapshot,{kind:'current',expectedCurrent:context.expectedCurrent})
    }
    check(input.kind==='NoChange','ProjectionAdoptionError')
    check(this.projection?.revision===input.revision&&input.revision===context.expectedCurrent,'StaleProjectionDelivery')
    return this.projection
  }
  present(change){
    this.#open();check(this.projection,'SceneUnavailable')
    shape(change,[],['focus','selectedItems','expandedItems','activeRegion','inspector','loading','viewMode','camera','timeCursor'])
    const ids=targets(this.projection),regions=new Set(this.projection.data.regions.map(r=>r.id))
    for(const key of ['selectedItems','expandedItems'])if(Object.hasOwn(change,key)){
      check(Array.isArray(change[key])&&change[key].length<=256,'PresentationLimitExceeded')
      check(new Set(change[key]).size===change[key].length&&change[key].every(id=>ids.has(id)),'InvalidPresentationTarget')
    }
    for(const key of ['focus','inspector'])if(Object.hasOwn(change,key))check(change[key]===null||ids.has(change[key]),'InvalidPresentationTarget')
    if(Object.hasOwn(change,'activeRegion'))check(change.activeRegion===null||regions.has(change.activeRegion),'InvalidPresentationTarget')
    if(Object.hasOwn(change,'loading'))check(typeof change.loading==='boolean','InvalidPresentationTarget')
    if(Object.hasOwn(change,'viewMode'))check(['spatial','structured'].includes(change.viewMode),'InvalidPresentationTarget')
    if(Object.hasOwn(change,'camera')){
      shape(change.camera,['x','y','z'])
      for(const key of ['x','y','z'])check(Number.isFinite(change.camera[key])&&change.camera[key]>=(key==='z'?.65:-1)&&change.camera[key]<=(key==='z'?1.5:1),'InvalidPresentationTarget')
    }
    if(Object.hasOwn(change,'timeCursor'))check(change.timeCursor===null||this.projection.data.temporal?.items.some(item=>item.itemId===change.timeCursor),'InvalidPresentationTarget')
    // Camera is bounded local presentation, not integer-only canonical source data.
    const {camera,...rest}=change
    this.#presentation=frozen({...this.#presentation,...copy(rest),...(camera?{camera:{...camera}}:{})})
    return this.#presentation
  }
  navigate(key){
    this.#open();const next=this.current(key);check(next,'SceneUnavailable')
    if(this.#presentation.activeScene===key)return this.#presentation
    const navigation=[...this.#presentation.navigation.slice(0,this.#presentation.navigationIndex+1),key].slice(-64)
    this.#presentation=rebase({...empty(),navigation,navigationIndex:navigation.length-1},next)
    return this.#presentation
  }
  #move(delta){
    this.#open();const index=this.#presentation.navigationIndex+delta
    if(index<0||index>=this.#presentation.navigation.length)return this.#presentation
    const next=this.current(this.#presentation.navigation[index]);check(next,'SceneUnavailable')
    this.#presentation=rebase({...empty(),navigation:this.#presentation.navigation,navigationIndex:index},next)
    return this.#presentation
  }
  back(){return this.#move(-1)}
  forward(){return this.#move(1)}
  action(id){
    this.#open();check(this.projection?.data.actions.some(a=>a.id===id),'StaleSceneAction')
    return frozen({projectionKey:this.projection.key,projectionRevision:this.projection.revision,sceneId:this.projection.key,actionId:id})
  }
  intent(handle){
    this.#open();shape(handle,['projectionKey','projectionRevision','sceneId','actionId'])
    const p=this.projection
    check(p&&handle.projectionKey===p.key&&handle.sceneId===p.key&&handle.projectionRevision===p.revision,'StaleSceneAction')
    const action=p.data.actions.find(a=>a.id===handle.actionId);check(action,'StaleSceneAction')
    return frozen({...copy(handle),ownerCommandDescriptor:action})
  }
  inspect(){return {keys:this.#cache.size,snapshots:[...this.#cache.values()].reduce((n,v)=>n+v.length,0),closed:this.#closed}}
  close(){this.#closed=true;this.#cache.clear();this.#presentation=frozen(empty())}
}

export function renderPlan(projection,presentation,capabilities={roles}){
  check(projection&&presentation.activeScene===projection.key,'RenderPlanError')
  const values=new Map([...projection.data.items,...projection.data.unresolved].map(v=>[v.id,v]))
  const selected=new Set(presentation.selectedItems),expanded=new Set(presentation.expandedItems)
  const active=id=>selected.has(id)||presentation.focus===id,related=new Set()
  const relations=projection.data.relations.map(relation=>{
    const highlighted=active(relation.from)||active(relation.to)
    if(highlighted){related.add(relation.from);related.add(relation.to)}
    return {...relation,active:highlighted}
  })
  const item=content=>({id:content.id,content,focused:presentation.focus===content.id,
    selected:selected.has(content.id),expanded:expanded.has(content.id),related:related.has(content.id),
    display:projection.data.presentation?.find(binding=>binding.itemId===content.id)??null})
  const regions=projection.data.regions.map(region=>{
    check(capabilities.roles.includes(region.role),'UnsupportedRenderer')
    return {...region,items:region.itemIds.map(id=>{
      check(values.has(id),'RenderPlanError')
      return item(values.get(id))
    })}
  })
  return frozen({projectionKey:projection.key,projectionRevision:projection.revision,sceneId:projection.key,
    purpose:projection.data.purpose,viewMode:presentation.viewMode,camera:presentation.camera,
    temporal:projection.data.temporal?{...projection.data.temporal,cursor:presentation.timeCursor}:null,
    regions,relations,actions:projection.data.actions.map(action=>({descriptor:action,
      handle:{projectionKey:projection.key,projectionRevision:projection.revision,sceneId:projection.key,actionId:action.id}})),
    inspector:presentation.inspector===null?null:values.get(presentation.inspector)??null,
    unplaced:[...values.values()].filter(v=>!projection.data.regions.some(r=>r.itemIds.includes(v.id)))
      .map(item),
    empty:values.size===0,truncated:projection.data.truncated,omittedByPolicy:projection.data.omittedByPolicy})
}

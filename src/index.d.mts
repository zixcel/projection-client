// Hatter downstream 2026: relations retain the canonical owner shape.
import type {SceneProjection,ProjectionIdentity,Action,Item,Unresolved,Relation} from '@hathq/projection-contracts/client'
export type {SceneProjection,ProjectionIdentity} from '@hathq/projection-contracts/client'
export type ViewMode='spatial'|'structured'
export interface PresentationState {readonly activeScene:string|null;readonly focus:string|null;readonly selectedItems:readonly string[];readonly expandedItems:readonly string[];readonly activeRegion:string|null;readonly navigation:readonly string[];readonly navigationIndex:number;readonly inspector:string|null;readonly loading:boolean;readonly viewMode:ViewMode}
export interface ActionHandle {readonly projectionKey:string;readonly projectionRevision:string;readonly sceneId:string;readonly actionId:string}
export interface SceneCommandIntent extends ActionHandle {readonly ownerCommandDescriptor:Action}
export type AdoptionContext={kind:'hydrate',expected:ProjectionIdentity}|{kind:'current',expectedCurrent:string|null}
export interface RenderItem {readonly id:string;readonly content:Item|Unresolved;readonly focused:boolean;readonly selected:boolean;readonly expanded:boolean;readonly related:boolean}
export interface RenderPlan {readonly projectionKey:string;readonly projectionRevision:string;readonly sceneId:string;readonly purpose:string;readonly viewMode:ViewMode;readonly relations:readonly (Relation & {readonly active:boolean})[];readonly regions:readonly {id:string;role:string;items:readonly RenderItem[]}[];readonly actions:readonly {descriptor:Action;handle:ActionHandle}[];readonly inspector:Item|Unresolved|null;readonly unplaced:readonly RenderItem[];readonly empty:boolean;readonly truncated:boolean;readonly omittedByPolicy:number}
export function projectionIdentity(snapshot:SceneProjection):ProjectionIdentity
export function renderPlan(projection:SceneProjection,presentation:PresentationState,capabilities?:{roles:readonly string[]}):RenderPlan
export class ClientProjectionRuntime {
  readonly projection:SceneProjection|null
  readonly presentation:PresentationState
  current(key:string):SceneProjection|null
  adopt(snapshot:unknown,context:AdoptionContext):SceneProjection
  input(input:unknown,context:{expectedCurrent:string|null}):SceneProjection
  present(change:Partial<Pick<PresentationState,'focus'|'selectedItems'|'expandedItems'|'activeRegion'|'inspector'|'loading'|'viewMode'>>):PresentationState
  navigate(key:string):PresentationState
  back():PresentationState
  forward():PresentationState
  action(id:string):ActionHandle
  intent(handle:unknown):SceneCommandIntent
  inspect():{keys:number;snapshots:number;closed:boolean}
  close():void
}

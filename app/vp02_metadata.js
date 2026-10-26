/** Identity of fictional exercise actors, NOT part of raw telemetry. */
export const ENTITIES_META=Object.freeze({
  'ECHO-ALPHA':Object.freeze({callSign:'ECHO-ALPHA',side:'BLUE',vehicleType:'Recon vehicle',model:'R-4X4',role:'Route reconnaissance',fictional:true}),
  'ECHO-BRAVO':Object.freeze({callSign:'ECHO-BRAVO',side:'RED',vehicleType:'Armoured transport',model:'AT-6X6',role:'Opposing-force convoy',fictional:true})
});
export function entityIdentity(id){const item=ENTITIES_META[id];if(!item)throw new Error(`Unknown simulated entity: ${id}`);return item;}
export function mapContext(mode){
  if(mode==='geographic')return 'REAL GEOGRAPHY · Czechia / Olomouc Region, near Hranice · fictional training replay';
  if(mode==='synthetic')return 'OFFLINE SCHEMATIC · invented cartography · same synthetic WGS84 unit positions';
  throw new Error(`Unknown map mode ${mode}`);
}

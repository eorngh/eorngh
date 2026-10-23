import {loadOfficialFacts} from '../backend/tour.mjs';
import {writeFile} from 'node:fs/promises';
let key='';for await(const chunk of process.stdin)key+=chunk;
const result=await loadOfficialFacts({kind:'domestic',parentId:'busan',city:'해운대',start:'2026-10-20',end:'2026-10-22'},key.trim());key='';
await writeFile('handoff/TOUR_LIVE_FACTS.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,records:result.records.length,checkedAt:result.checkedAt,titles:result.records.map(r=>r.title)}));

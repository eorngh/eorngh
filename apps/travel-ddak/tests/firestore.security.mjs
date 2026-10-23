import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
test('현재 운영 규칙: 미인증·타인 접근 차단, 본인 여행딱 사본 허용',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-travelddak',firestore:{host:'127.0.0.1',port:8185,rules:await readFile('firebase.rules.baseline','utf8')}});
 try{
  const alice=env.authenticatedContext('qa-alice').firestore(),bob=env.authenticatedContext('qa-bob').firestore(),anon=env.unauthenticatedContext().firestore();
  const path='users/qa-alice/travelDdak/snapshot';
  await assertFails(setDoc(doc(anon,path),{revision:1}));
  await assertSucceeds(setDoc(doc(alice,path),{revision:1,state:{version:1,trips:[],recents:[]}}));
  await assertSucceeds(getDoc(doc(alice,path)));
  await assertFails(getDoc(doc(bob,path)));
  await assertFails(setDoc(doc(bob,path),{revision:2}));
  await assertFails(getDoc(doc(anon,path)));
 }finally{await env.cleanup();}
});

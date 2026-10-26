import test from 'node:test';
import assert from 'node:assert/strict';
import {Repository} from '../public/store.mjs';
import {readRegistrationDraft,registrationDraftKey} from '../public/registration.mjs';
const storage=entries=>({getItem:key=>entries.get(key)??null});
test('registration drafts are isolated by both account and Firebase project',()=>{
  const alice=new Repository('alice','project-one'),bob=new Repository('bob','project-one'),other=new Repository('alice','project-two');
  const values=new Map([[registrationDraftKey(alice),JSON.stringify({roadAddress:'Alice synthetic address'})]]);
  assert.equal(readRegistrationDraft(storage(values),alice).roadAddress,'Alice synthetic address');
  assert.deepEqual(readRegistrationDraft(storage(values),bob),{});
  assert.deepEqual(readRegistrationDraft(storage(values),other),{});
});
test('legacy unowned drafts are preserved for device-only use and hidden from signed-in users',()=>{
  const values=new Map([['hj365-registration-draft',JSON.stringify({name:'Legacy device draft'})]]);
  assert.equal(readRegistrationDraft(storage(values),new Repository()).name,'Legacy device draft');
  assert.deepEqual(readRegistrationDraft(storage(values),new Repository('alice','project-one')),{});
  assert(values.has('hj365-registration-draft'));
});
test('corrupt draft contents or unavailable storage cannot block registration startup',()=>{
  const repo=new Repository();
  for(const raw of ['bad JSON','null','[]','false'])assert.deepEqual(readRegistrationDraft(storage(new Map([[registrationDraftKey(repo),raw]])),repo),{});
  assert.deepEqual(readRegistrationDraft({getItem(){throw Error('Storage denied');}},repo),{});
});

import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, Timestamp} from 'firebase/firestore';
import {ref, uploadBytes, getBytes, deleteObject, listAll} from 'firebase/storage';

// A missing emulator must fail this suite, never turn a security check into SKIP.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Run npm run test:rules: both Firestore and Storage emulators are required.');
}
const projectId = 'demo-field-ai365';
let env;
const record = () => ({payload: JSON.stringify({id: 'site-one', name: 'Synthetic site'}), revision: 'v1', deleted: false});
const path = 'hyeonjang365Users/alice/sites/site-one';
const photoPath = 'hyeonjang365Users/alice/photos/photo-v1';
const jpeg = new Uint8Array([255, 216, 255, 217]);
const user = uid => env.authenticatedContext(uid);
const photo = context => ref(context.storage(), photoPath);
before(async () => {
  env = await initializeTestEnvironment({projectId,
    firestore: {host: '127.0.0.1', port: 8186,
      rules: await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8')},
    storage: {host: '127.0.0.1', port: 9299,
      rules: await readFile(new URL('../firebase/storage.rules', import.meta.url), 'utf8')}});
});
beforeEach(async () => {await env.clearFirestore(); await env.clearStorage();});
after(async () => {await env?.cleanup();});

test('owner can create, read, list, update and delete the actual cloud envelope', async () => {
  const db = user('alice').firestore(), item = doc(db, path);
  await assertSucceeds(setDoc(item, record()));
  await assertSucceeds(getDoc(item));
  await assertSucceeds(getDocs(collection(db, 'hyeonjang365Users/alice/sites')));
  await assertSucceeds(updateDoc(item, {revision: 'v2'}));
  await assertSucceeds(deleteDoc(item));
});
for (const identity of ['anonymous', 'bob']) {
  test(`${identity} cannot read, list, create, update or delete another workspace`, async () => {
    await setDoc(doc(user('alice').firestore(), path), record());
    const context = identity === 'anonymous' ? env.unauthenticatedContext() : user(identity);
    const db = context.firestore(), item = doc(db, path);
    await assertFails(getDoc(item));
    await assertFails(getDocs(collection(db, 'hyeonjang365Users/alice/sites')));
    await assertFails(setDoc(doc(db, 'hyeonjang365Users/alice/sites/new-site'), record()));
    await assertFails(updateDoc(item, {revision: 'v2'}));
    await assertFails(deleteDoc(item));
  });
}
test('create and update reject extra fields, invalid types, missing fields and oversized payloads', async () => {
  const item = doc(user('alice').firestore(), path);
  const invalid = [{...record(), role: 'admin'}, {...record(), payload: 1},
    {...record(), revision: 1}, {...record(), deleted: 'false'},
    {payload: '{}', revision: 'v1'}, {...record(), payload: 'x'.repeat(400001)},
    {...record(), revision: 'x'.repeat(101)}];
  for (const data of invalid) await assertFails(setDoc(item, data));
  await setDoc(item, record());
  for (const data of invalid) await assertFails(setDoc(item, data));
});
test('all seven application collections accept the cloud envelope; unknown paths deny access', async () => {
  const db = user('alice').firestore();
  for (const name of ['sites', 'logs', 'photos', 'documents', 'payments', 'clients', 'profile']) {
    await assertSucceeds(setDoc(doc(db, `hyeonjang365Users/alice/${name}/fixture`), record()));
  }
  await assertFails(setDoc(doc(db, 'hyeonjang365Users/alice/admin/fixture'), record()));
  await assertFails(getDoc(doc(db, 'unrelated/fixture')));
  await assertFails(setDoc(doc(db, 'unrelated/fixture'), record()));
});
test('deletion lock blocks creates and updates while permitting owner cleanup', async () => {
  const db = user('alice').firestore(), item = doc(db, path), lock = doc(db, 'hyeonjang365Users/alice');
  await setDoc(item, record());
  await assertSucceeds(setDoc(lock, {deleting: true, lockedAt: Timestamp.now()}));
  await assertFails(updateDoc(item, {revision: 'v2'}));
  await assertFails(setDoc(doc(db, 'hyeonjang365Users/alice/sites/new-site'), record()));
  await assertFails(updateDoc(lock, {deleting: false}));
  await assertFails(deleteDoc(lock));
  await assertFails(setDoc(doc(user('bob').firestore(), 'hyeonjang365Users/alice'), {deleting: true, lockedAt: Timestamp.now()}));
  await assertSucceeds(getDoc(item));
  await assertSucceeds(deleteDoc(item));
});
test('owner can upload, read, list, replace and delete photos', async () => {
  const context = user('alice'), item = photo(context);
  await assertSucceeds(uploadBytes(item, jpeg, {contentType: 'image/jpeg'}));
  await assertSucceeds(getBytes(item));
  await assertSucceeds(listAll(ref(context.storage(), 'hyeonjang365Users/alice/photos')));
  await assertSucceeds(uploadBytes(item, jpeg, {contentType: 'image/png'}));
  await assertSucceeds(deleteObject(item));
});
for (const identity of ['anonymous', 'bob']) {
  test(`${identity} cannot read, list, upload, replace or delete another user's photos`, async () => {
    await uploadBytes(photo(user('alice')), jpeg, {contentType: 'image/jpeg'});
    const context = identity === 'anonymous' ? env.unauthenticatedContext() : user(identity);
    await assertFails(getBytes(photo(context)));
    await assertFails(listAll(ref(context.storage(), 'hyeonjang365Users/alice/photos')));
    await assertFails(uploadBytes(ref(context.storage(), photoPath + '-new'), jpeg, {contentType: 'image/jpeg'}));
    await assertFails(uploadBytes(photo(context), jpeg, {contentType: 'image/jpeg'}));
    await assertFails(deleteObject(photo(context)));
  });
}
test('photo rules reject disallowed MIME, files over 20 MiB and unrelated paths', async () => {
  const context = user('alice');
  await assertFails(uploadBytes(photo(context), jpeg, {contentType: 'text/html'}));
  await assertFails(uploadBytes(photo(context), new Uint8Array(20 * 1024 * 1024 + 1), {contentType: 'image/jpeg'}));
  await assertFails(uploadBytes(ref(context.storage(), 'unrelated/photo'), jpeg, {contentType: 'image/jpeg'}));
});
test('Firestore deletion lock also blocks Storage uploads and replacements, but permits cleanup', async () => {
  const context = user('alice'), item = photo(context);
  await uploadBytes(item, jpeg, {contentType: 'image/jpeg'});
  await setDoc(doc(context.firestore(), 'hyeonjang365Users/alice'), {deleting: true, lockedAt: Timestamp.now()});
  await assertFails(uploadBytes(item, jpeg, {contentType: 'image/jpeg'}));
  await assertFails(uploadBytes(ref(context.storage(), photoPath + '-new'), jpeg, {contentType: 'image/jpeg'}));
  await assertSucceeds(getBytes(item));
  await assertSucceeds(deleteObject(item));
});

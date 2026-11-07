const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 20 });

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return request.auth;
}
function cleanText(v, max=120) { return String(v ?? '').replace(/\s+/g,' ').trim().slice(0,max); }
function inviteCode() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf=crypto.randomBytes(10); let out='';
  for(let i=0;i<10;i++) out += alphabet[buf[i] % alphabet.length];
  return `${out.slice(0,4)}-${out.slice(4,7)}-${out.slice(7)}`;
}
async function getActiveMember(companyId, uid) {
  const snap=await db.doc(`companies/${companyId}/members/${uid}`).get();
  if(!snap.exists || snap.data().status !== 'active') throw new HttpsError('permission-denied','회사 사용 권한이 없습니다.');
  return snap.data();
}

exports.createCompany = onCall(async (request) => {
  const auth=requireAuth(request); const uid=auth.uid;
  const name=cleanText(request.data?.name,80);
  const ownerName=cleanText(request.data?.ownerName || auth.token.name || '',60);
  const phone=cleanText(request.data?.phone,30); const address=cleanText(request.data?.address,180);
  if(name.length < 2) throw new HttpsError('invalid-argument','업체명을 2자 이상 입력하세요.');
  const userRef=db.doc(`users/${uid}`);
  const companyRef=db.collection('companies').doc();
  await db.runTransaction(async tx=>{
    const userSnap=await tx.get(userRef);
    if(userSnap.exists && userSnap.data().companyId && userSnap.data().status==='active') {
      throw new HttpsError('already-exists','이미 가입된 업체가 있습니다.');
    }
    const now=FieldValue.serverTimestamp();
    tx.set(companyRef,{name,ownerUid:uid,ownerName,phone,address,status:'active',plan:'alpha',createdAt:now,updatedAt:now});
    tx.set(companyRef.collection('members').doc(uid),{uid,email:auth.token.email||'',displayName:auth.token.name||ownerName,role:'owner',status:'active',createdAt:now});
    tx.set(userRef,{uid,email:auth.token.email||'',displayName:auth.token.name||ownerName,companyId:companyRef.id,role:'owner',status:'active',updatedAt:now},{merge:true});
    tx.set(companyRef.collection('auditLogs').doc(),{type:'company.created',actorUid:uid,createdAt:now});
  });
  return {ok:true,companyId:companyRef.id};
});

exports.createInvite = onCall(async (request) => {
  const auth=requireAuth(request); const uid=auth.uid;
  const userSnap=await db.doc(`users/${uid}`).get();
  if(!userSnap.exists || userSnap.data().status!=='active') throw new HttpsError('permission-denied','회사 가입이 필요합니다.');
  const companyId=userSnap.data().companyId; const member=await getActiveMember(companyId,uid);
  if(!['owner','admin'].includes(member.role)) throw new HttpsError('permission-denied','대표 또는 관리자만 초대할 수 있습니다.');
  const role=['manager','worker'].includes(request.data?.role) ? request.data.role : 'worker';
  const code=inviteCode(); const ref=db.doc(`invites/${code}`);
  const expires=Timestamp.fromMillis(Date.now()+7*24*60*60*1000);
  await ref.set({code,companyId,role,status:'active',createdBy:uid,createdAt:FieldValue.serverTimestamp(),expiresAt:expires,usedBy:null});
  return {ok:true,code,role,expiresAt:expires.toDate().toISOString()};
});

exports.joinCompany = onCall(async (request) => {
  const auth=requireAuth(request); const uid=auth.uid;
  const code=cleanText(request.data?.code,20).toUpperCase();
  if(!code) throw new HttpsError('invalid-argument','초대코드를 입력하세요.');
  const inviteRef=db.doc(`invites/${code}`); const userRef=db.doc(`users/${uid}`);
  let companyId='';
  await db.runTransaction(async tx=>{
    const [inviteSnap,userSnap]=await Promise.all([tx.get(inviteRef),tx.get(userRef)]);
    if(!inviteSnap.exists) throw new HttpsError('not-found','유효하지 않은 초대코드입니다.');
    const inv=inviteSnap.data(); companyId=inv.companyId;
    if(inv.status!=='active') throw new HttpsError('failed-precondition','이미 사용되었거나 중지된 초대코드입니다.');
    if(inv.expiresAt && inv.expiresAt.toMillis() < Date.now()) throw new HttpsError('deadline-exceeded','초대코드가 만료되었습니다.');
    if(userSnap.exists && userSnap.data().companyId && userSnap.data().status==='active') throw new HttpsError('already-exists','이미 가입된 업체가 있습니다.');
    const now=FieldValue.serverTimestamp();
    tx.set(db.doc(`companies/${companyId}/members/${uid}`),{uid,email:auth.token.email||'',displayName:auth.token.name||'',role:inv.role||'worker',status:'active',createdAt:now});
    tx.set(userRef,{uid,email:auth.token.email||'',displayName:auth.token.name||'',companyId,role:inv.role||'worker',status:'active',updatedAt:now},{merge:true});
    tx.update(inviteRef,{status:'used',usedBy:uid,usedAt:now});
    tx.set(db.collection(`companies/${companyId}/auditLogs`).doc(),{type:'member.joined',actorUid:uid,role:inv.role||'worker',createdAt:now});
  });
  return {ok:true,companyId};
});

exports.setMemberStatus = onCall(async (request) => {
  const auth=requireAuth(request); const uid=auth.uid;
  const targetUid=cleanText(request.data?.uid,128); const status=request.data?.status;
  if(!targetUid || !['active','disabled'].includes(status)) throw new HttpsError('invalid-argument','회원과 상태를 확인하세요.');
  const userSnap=await db.doc(`users/${uid}`).get();
  if(!userSnap.exists || userSnap.data().status!=='active') throw new HttpsError('permission-denied','회사 가입이 필요합니다.');
  const companyId=userSnap.data().companyId; const member=await getActiveMember(companyId,uid);
  if(!['owner','admin'].includes(member.role)) throw new HttpsError('permission-denied','대표 또는 관리자만 변경할 수 있습니다.');
  const targetRef=db.doc(`companies/${companyId}/members/${targetUid}`); const target=await targetRef.get();
  if(!target.exists) throw new HttpsError('not-found','회원을 찾을 수 없습니다.');
  if(target.data().role==='owner') throw new HttpsError('failed-precondition','대표 계정은 중지할 수 없습니다.');
  const batch=db.batch(); const now=FieldValue.serverTimestamp();
  batch.update(targetRef,{status,updatedAt:now});
  batch.set(db.doc(`users/${targetUid}`),{status,updatedAt:now},{merge:true});
  batch.set(db.collection(`companies/${companyId}/auditLogs`).doc(),{type:'member.status',actorUid:uid,targetUid,status,createdAt:now});
  await batch.commit();
  return {ok:true};
});


exports.migrateLegacyData = onCall({ timeoutSeconds: 120 }, async (request) => {
  const auth=requireAuth(request); const uid=auth.uid;
  const userSnap=await db.doc(`users/${uid}`).get();
  if(!userSnap.exists || userSnap.data().status!=='active' || userSnap.data().role!=='owner') {
    throw new HttpsError('permission-denied','대표 계정만 기존 자료를 이전할 수 있습니다.');
  }
  const companyId=userSnap.data().companyId;
  const companySnap=await db.doc(`companies/${companyId}`).get();
  if(!companySnap.exists || companySnap.data().ownerUid!==uid) throw new HttpsError('permission-denied','업체 대표 확인에 실패했습니다.');

  // Alpha migration safety: only the historical project administrator can import the old shared collections.
  const legacyAdmin='eorngh@gmail.com';
  if(String(auth.token.email||'').toLowerCase()!==legacyAdmin) throw new HttpsError('permission-denied','기존 자료 이전 권한이 없습니다.');

  const dryRun=request.data?.dryRun===true;
  const [siteSnap,logSnap]=await Promise.all([db.collection('sites').get(),db.collection('worklogs').get()]);
  if(dryRun) return {ok:true,dryRun:true,sites:siteSnap.size,worklogs:logSnap.size};

  let writes=0, migratedSites=0, migratedLogs=0; let batch=db.batch();
  async function flush(){if(writes===0)return;await batch.commit();batch=db.batch();writes=0;}
  for(const d of siteSnap.docs){
    const ref=db.doc(`companies/${companyId}/sites/${d.id}`);
    batch.set(ref,{...d.data(),companyId,migratedFrom:'legacy/sites',migratedAt:FieldValue.serverTimestamp()},{merge:true});
    writes++;migratedSites++;if(writes>=400)await flush();
  }
  for(const d of logSnap.docs){
    const ref=db.doc(`companies/${companyId}/worklogs/${d.id}`);
    batch.set(ref,{...d.data(),companyId,migratedFrom:'legacy/worklogs',migratedAt:FieldValue.serverTimestamp()},{merge:true});
    writes++;migratedLogs++;if(writes>=400)await flush();
  }
  batch.set(db.collection(`companies/${companyId}/auditLogs`).doc(),{type:'legacy.migrated',actorUid:uid,sites:migratedSites,worklogs:migratedLogs,createdAt:FieldValue.serverTimestamp()});writes++;
  await flush();
  return {ok:true,dryRun:false,sites:migratedSites,worklogs:migratedLogs};
});


// -----------------------------------------------------------------------------
// Play Store / 개인정보 정책 대응 - 계정 및 데이터 삭제
// -----------------------------------------------------------------------------
async function anonymizeCreatorFields(companyId, uid) {
  const collections = ['sites', 'worklogs', 'documents'];
  for (const name of collections) {
    const snap = await db.collection(`companies/${companyId}/${name}`).where('createdBy', '==', uid).get();
    let batch = db.batch(); let writes = 0;
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        createdBy: null,
        createdByName: '삭제된 사용자',
        updatedAt: FieldValue.serverTimestamp(),
      });
      writes++;
      if (writes >= 400) { await batch.commit(); batch = db.batch(); writes = 0; }
    }
    if (writes) await batch.commit();
  }
}

async function deleteCompanyStorage(companyId) {
  try {
    const bucket = getStorage().bucket();
    await bucket.deleteFiles({ prefix: `companies/${companyId}/` });
  } catch (e) {
    console.error('company storage delete failed', companyId, e);
    throw new HttpsError('internal', '회사 파일 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
  }
}

exports.deleteMyAccount = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  const auth = requireAuth(request); const uid = auth.uid;
  if (request.data?.confirm !== true) throw new HttpsError('failed-precondition', '계정 삭제 확인이 필요합니다.');

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const user = userSnap.exists ? userSnap.data() : {};
  const companyId = cleanText(user?.companyId, 128);
  const role = cleanText(user?.role, 30);

  if (companyId) {
    const companyRef = db.doc(`companies/${companyId}`);
    const companySnap = await companyRef.get();
    const company = companySnap.exists ? companySnap.data() : {};

    if (role === 'owner' && company?.ownerUid === uid) {
      // 대표 계정 삭제는 회사 작업공간 전체 삭제로 처리한다.
      const memberSnap = await companyRef.collection('members').get();
      const inviteSnap = await db.collection('invites').where('companyId', '==', companyId).get();

      // 다른 직원은 인증 계정까지 삭제하지 않고 회사 연결만 해제한다.
      let batch = db.batch(); let writes = 0;
      for (const m of memberSnap.docs) {
        if (m.id === uid) continue;
        batch.set(db.doc(`users/${m.id}`), {
          companyId: FieldValue.delete(), role: FieldValue.delete(), status: 'unlinked', updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        writes++;
        if (writes >= 400) { await batch.commit(); batch = db.batch(); writes = 0; }
      }
      for (const inv of inviteSnap.docs) {
        batch.delete(inv.ref); writes++;
        if (writes >= 400) { await batch.commit(); batch = db.batch(); writes = 0; }
      }
      if (writes) await batch.commit();

      await deleteCompanyStorage(companyId);
      // Admin SDK Firestore의 recursiveDelete로 하위 컬렉션까지 삭제한다.
      await db.recursiveDelete(companyRef);
      await userRef.delete().catch(() => {});
    } else {
      // 직원 계정: 개인 계정/멤버십을 삭제하고 회사 소유 업무기록의 작성자 식별값은 익명화한다.
      await anonymizeCreatorFields(companyId, uid);
      await db.doc(`companies/${companyId}/members/${uid}`).delete().catch(() => {});
      await userRef.delete().catch(() => {});
      await db.collection(`companies/${companyId}/auditLogs`).add({
        type: 'account.deleted', actor: 'deleted-user', createdAt: FieldValue.serverTimestamp()
      }).catch(() => {});
    }
  } else {
    await userRef.delete().catch(() => {});
  }

  await getAuth().deleteUser(uid).catch((e) => {
    if (e?.code !== 'auth/user-not-found') throw e;
  });
  return { ok: true, deleted: true };
});

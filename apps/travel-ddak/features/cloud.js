import {initializeApp} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword,signInWithPopup,signInWithCredential,GoogleAuthProvider,signOut} from 'firebase/auth';
import {getFirestore,doc,getDoc,runTransaction} from 'firebase/firestore/lite';
import {getFunctions,httpsCallable} from 'firebase/functions';
import config from '../dist/firebase-config.js';
import {validateState} from '../dist/core.js';
const app=initializeApp(config,'travel-ddak');
const auth=getAuth(app),db=getFirestore(app);
let inspected=null;
async function owner(){await auth.authStateReady();if(!auth.currentUser)throw Error('먼저 기존 딱모둠 계정으로 로그인하세요.');return auth.currentUser;}
async function reference(){const user=await owner();return {user,ref:doc(db,'users',user.uid,'travelDdak','snapshot')};}
export async function login(email,password){await signInWithEmailAndPassword(auth,email,password);inspected=null;return auth.currentUser.email;}
export async function loginGoogle(){
 if(window.Capacitor?.isNativePlatform?.()){
  const token=await(await import('../dist/native-google.js')).signInGoogle();
  await signInWithCredential(auth,GoogleAuthProvider.credential(token));inspected=null;return auth.currentUser.email;
 }
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 await signInWithPopup(auth,provider);inspected=null;return auth.currentUser.email;
}
export async function logout(){await signOut(auth);inspected=null;if(window.Capacitor?.isNativePlatform?.())await(await import('../dist/native-google.js')).clearGoogle().catch(()=>{});}
export async function hybrid(data){await owner();return (await httpsCallable(getFunctions(app,'asia-northeast3'),'travelDdakHybrid',{timeout:55_000})(data)).data;}
export async function inspect(){const {user,ref}=await reference();const snapshot=await getDoc(ref);const data=snapshot.exists()?snapshot.data():null;if(data)validateState(data.state);inspected={uid:user.uid,revision:data?.revision||0};return {email:user.email,revision:inspected.revision,state:data?.state||null};}
export async function upload(state){
 const safe=validateState(state);if(new Blob([JSON.stringify(safe)]).size>700_000)throw Error('클라우드 사본은 700KB까지 지원합니다. 파일 백업을 사용하세요.');
 const {user,ref}=await reference();if(inspected?.uid!==user.uid)throw Error('먼저 클라우드 사본 확인을 눌러 충돌 여부를 확인하세요.');
 const expected=inspected.revision;
 const revision=await runTransaction(db,async transaction=>{
  const latest=await transaction.get(ref);const actual=latest.exists()?latest.data().revision||0:0;
  if(actual!==expected)throw Error('다른 기기에서 사본이 변경됐습니다. 클라우드 사본을 다시 확인하고 가져온 뒤 저장하세요.');
  transaction.set(ref,{state:safe,revision:actual+1,updatedAt:new Date().toISOString()});return actual+1;
 });inspected={uid:user.uid,revision};return revision;
}
export async function remove(){const {ref}=await reference();await runTransaction(db,async transaction=>{const latest=await transaction.get(ref);if(latest.exists())transaction.delete(ref);});inspected=null;}
export function friendly(error){const code=error?.code;return ({'auth/invalid-credential':'이메일 또는 비밀번호를 확인하세요.','auth/network-request-failed':'인터넷 연결을 확인하세요. 로컬 여행은 보존됩니다.','auth/too-many-requests':'로그인 시도가 많습니다. 잠시 후 다시 시도하세요.','permission-denied':'클라우드 접근이 거부됐습니다. 로그인 계정과 권한을 확인하세요.','unavailable':'클라우드에 연결하지 못했습니다. 로컬 여행은 보존됩니다.'})[code]||(code?'연결을 완료하지 못했습니다. '+code:error.message);}

export async function autoJobs(data){await owner();return (await httpsCallable(getFunctions(app,'asia-northeast3'),'travelDdakAuto',{timeout:60_000})(data)).data;}

export async function session(){await auth.authStateReady();return auth.currentUser?{email:auth.currentUser.email}:null;}

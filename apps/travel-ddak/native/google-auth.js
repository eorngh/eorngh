import {GoogleSignIn} from '@capawesome/capacitor-google-sign-in';
// Public web OAuth client for the existing ddakmodum Google provider.
const clientId='962121484077-gshaf63eq76aedr7elpa9uok2oc0l0t0.apps.googleusercontent.com';
let initialized;
export async function signInGoogle(){
 initialized??=GoogleSignIn.initialize({clientId}).catch(error=>{initialized=null;throw error;});
 await initialized;
 try{
  const result=await GoogleSignIn.signIn();
  if(typeof result.idToken!=='string'||!result.idToken)throw Error('Google 인증 응답을 확인하지 못했습니다.');
  return result.idToken; // Used in memory by Firebase; never logged or separately persisted.
 }catch(error){
  if(/cancel/i.test(String(error?.code)))throw Error('Google 로그인을 취소했습니다. 기본 여행은 계속 사용할 수 있습니다.');
  throw Error('Google 로그인을 완료하지 못했습니다. 기기의 Google 계정·Play 서비스와 앱 서명 등록을 확인하세요.');
 }
}
export async function clearGoogle(){if(initialized)await GoogleSignIn.signOut();}

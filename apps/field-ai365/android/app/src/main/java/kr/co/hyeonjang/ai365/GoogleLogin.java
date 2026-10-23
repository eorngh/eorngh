package kr.co.hyeonjang.ai365;
import android.app.Activity;
import android.os.CancellationSignal;
import androidx.credentials.*;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.*;
import java.util.concurrent.Executor;
public final class GoogleLogin {
 public interface Result { void success(String token); void failure(); }
 public static void start(Activity activity,String clientId,Result result){
  GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder(clientId).build();
  GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
  Executor main=activity::runOnUiThread;
  CredentialManager.create(activity).getCredentialAsync(activity,request,new CancellationSignal(),main,new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
   public void onResult(GetCredentialResponse response){try{Credential credential=response.getCredential();if(!(credential instanceof CustomCredential))throw new IllegalStateException();CustomCredential custom=(CustomCredential)credential;if(!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType()))throw new IllegalStateException();result.success(GoogleIdTokenCredential.createFrom(custom.getData()).getIdToken());}catch(Exception e){result.failure();}}
   public void onError(GetCredentialException error){result.failure();}
  });
 }
}

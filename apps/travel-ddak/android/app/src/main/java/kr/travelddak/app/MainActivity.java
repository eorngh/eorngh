package kr.travelddak.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState){registerPlugin(TravelPhotosPlugin.class);super.onCreate(savedInstanceState);}
}

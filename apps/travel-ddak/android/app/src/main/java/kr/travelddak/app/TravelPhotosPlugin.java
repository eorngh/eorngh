package kr.travelddak.app;

import android.Manifest;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name="TravelPhotos",permissions={
 @Permission(alias="images",strings={Manifest.permission.READ_MEDIA_IMAGES}),
 @Permission(alias="selected",strings={Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED}),
 @Permission(alias="storage",strings={Manifest.permission.READ_EXTERNAL_STORAGE}),
 @Permission(alias="photoLocation",strings={Manifest.permission.ACCESS_MEDIA_LOCATION})
})
public class TravelPhotosPlugin extends Plugin {
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private boolean granted(String permission){return ContextCompat.checkSelfPermission(getContext(),permission)==PackageManager.PERMISSION_GRANTED;}
 private String access(){
  if(Build.VERSION.SDK_INT>=33&&granted(Manifest.permission.READ_MEDIA_IMAGES))return "full";
  if(Build.VERSION.SDK_INT>=34&&granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED))return "limited";
  if(Build.VERSION.SDK_INT<33&&granted(Manifest.permission.READ_EXTERNAL_STORAGE))return "full";
  return "denied";
 }
 private JSObject permissionInfo(){JSObject r=new JSObject();r.put("access",access());r.put("photoLocation",Build.VERSION.SDK_INT<29||granted(Manifest.permission.ACCESS_MEDIA_LOCATION));return r;}
 @PluginMethod public void status(PluginCall call){call.resolve(permissionInfo());}
 // This is called only after the in-app purpose explanation and an explicit user action.
 @PluginMethod public void allow(PluginCall call){
  ArrayList<String> aliases=new ArrayList<>();aliases.add(Build.VERSION.SDK_INT>=33?"images":"storage");
  if(Build.VERSION.SDK_INT>=34)aliases.add("selected");
  if(Build.VERSION.SDK_INT>=29)aliases.add("photoLocation");
  requestPermissionForAliases(aliases.toArray(new String[0]),call,"permissionResult");
 }
 @PermissionCallback private void permissionResult(PluginCall call){call.resolve(permissionInfo());}
 private long[] dates(PluginCall call)throws Exception{
  String zone=call.getString("timeZone","Asia/Seoul");if(!Arrays.asList(TimeZone.getAvailableIDs()).contains(zone))throw new Exception();
  String start=call.getString("start",""),end=call.getString("end","");
  if(!start.matches("\\d{4}-\\d{2}-\\d{2}")||!end.matches("\\d{4}-\\d{2}-\\d{2}"))throw new Exception();
  SimpleDateFormat f=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);f.setLenient(false);f.setTimeZone(TimeZone.getTimeZone(zone));
  Date a=f.parse(start),b=f.parse(end);if(a==null||b==null||b.before(a)||b.getTime()-a.getTime()>60L*86400000)throw new Exception();
  Calendar c=Calendar.getInstance(f.getTimeZone());c.setTime(b);c.add(Calendar.DATE,1);return new long[]{a.getTime(),c.getTimeInMillis()};
 }
 @PluginMethod public void scan(PluginCall call){
  if(access().equals("denied")){call.reject("사진 접근이 허용되지 않았습니다.","PHOTO_PERMISSION_DENIED");return;}
  final long[] range;try{range=dates(call);}catch(Exception e){call.reject("사진을 찾을 여행 기간·시간대를 확인하세요.","PHOTO_DATE_INVALID");return;}
  final long after;try{after=Long.parseLong(call.getString("afterId","0"));if(after<0)throw new Exception();}catch(Exception e){call.reject("사진 페이지를 확인하세요.");return;}
  final int limit=Math.max(1,Math.min(200,call.getInt("limit",100)));
  worker.execute(()->{
   try{
    String taken=MediaStore.Images.Media.DATE_TAKEN,added=MediaStore.Images.Media.DATE_ADDED,id=MediaStore.Images.Media._ID;
    String where="("+id+">?) AND (("+taken+">=? AND "+taken+"<?) OR (("+taken+" IS NULL OR "+taken+"=0) AND "+added+">=? AND "+added+"<?))";
    String[] args={String.valueOf(after),String.valueOf(range[0]),String.valueOf(range[1]),String.valueOf(range[0]/1000),String.valueOf(range[1]/1000)};
    String[] projection={id,taken,added,MediaStore.Images.Media.WIDTH,MediaStore.Images.Media.HEIGHT};
    JSArray items=new JSArray();long last=after;boolean more=false;
    try(Cursor cursor=getContext().getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,projection,where,args,id+" ASC")){
     if(cursor!=null)while(cursor.moveToNext()){
      if(items.length()>=limit){more=true;break;}
      long photoId=cursor.getLong(0),shot=cursor.getLong(1);boolean estimated=shot<=0;if(estimated)shot=cursor.getLong(2)*1000;
      Uri uri=ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,photoId);
      JSObject photo=new JSObject();photo.put("id",String.valueOf(photoId));photo.put("takenAt",shot);photo.put("timeEstimated",estimated);photo.put("width",cursor.getInt(3));photo.put("height",cursor.getInt(4));photo.put("hasLocation",false);
      if(Build.VERSION.SDK_INT<29||granted(Manifest.permission.ACCESS_MEDIA_LOCATION)){
       Uri original=Build.VERSION.SDK_INT>=29?MediaStore.setRequireOriginal(uri):uri;
       try(InputStream stream=getContext().getContentResolver().openInputStream(original)){
        if(stream!=null){ExifInterface exif=new ExifInterface(stream);float[] coords=new float[2];if(exif.getLatLong(coords)&&Float.isFinite(coords[0])&&Float.isFinite(coords[1])&&Math.abs(coords[0])<=90&&Math.abs(coords[1])<=180){photo.put("latitude",(double)coords[0]);photo.put("longitude",(double)coords[1]);photo.put("hasLocation",true);}}
       }catch(Exception ignored){/* No location is unknown, never the coordinate (0,0). */}
      }
      items.put(photo);last=photoId;
     }
    }
    JSObject result=permissionInfo();result.put("photos",items);result.put("afterId",String.valueOf(last));result.put("hasMore",more);call.resolve(result);
   }catch(SecurityException e){call.reject("사진 접근 권한이 변경됐습니다. 기본 여행은 계속 사용할 수 있습니다.","PHOTO_PERMISSION_DENIED");}
   catch(Exception e){call.reject("기기 사진 목록을 읽지 못했습니다. 원본은 변경되지 않았습니다.","PHOTO_READ_FAILED");}
  });
 }
 @PluginMethod public void thumbnail(PluginCall call){
  if(access().equals("denied")){call.reject("사진 접근 권한이 없습니다.","PHOTO_PERMISSION_DENIED");return;}
  final long id;try{id=Long.parseLong(call.getString("id",""));if(id<=0)throw new Exception();}catch(Exception e){call.reject("사진 식별자를 확인하세요.");return;}
  worker.execute(()->{try{
   Uri uri=ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,id);
   Bitmap bitmap=Build.VERSION.SDK_INT>=29?getContext().getContentResolver().loadThumbnail(uri,new Size(320,320),null):MediaStore.Images.Thumbnails.getThumbnail(getContext().getContentResolver(),id,MediaStore.Images.Thumbnails.MINI_KIND,null);
   if(bitmap==null)throw new Exception();ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,70,bytes);bitmap.recycle();JSObject r=new JSObject();r.put("dataUrl","data:image/jpeg;base64,"+Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP));call.resolve(r);
  }catch(Exception e){call.reject("이 사진의 미리보기를 열 수 없습니다.","PHOTO_PREVIEW_UNAVAILABLE");}});
 }
 @Override protected void handleOnDestroy(){worker.shutdownNow();}
}

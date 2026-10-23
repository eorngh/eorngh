import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Native exports use the system share sheet, without broad storage permissions.
export async function exportFile(data, name) {
  const result = await Filesystem.writeFile({
    path: `exports/${Date.now()}-${name}`,
    data, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true
  });
  await Share.share({title: name, url: result.uri, dialogTitle: '여행딱 파일 저장·공유'});
}

import {registerPlugin} from '@capacitor/core';
const photos=registerPlugin('TravelPhotos');
export const status=()=>photos.status();
export const allow=()=>photos.allow();
export const scan=options=>photos.scan(options);
export const thumbnail=id=>photos.thumbnail({id});

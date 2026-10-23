import {App} from '@capacitor/app';
export async function bindBackButton(){return App.addListener('backButton',()=>window.dispatchEvent(new Event('travel-ddak-back')));}

import { web } from "@nfjs/back";
import { registerCustomElementsDir } from "@nfjs/front-server";
import { upload as nfcfilesUpload, download as nfcfilesDownload, info as nfcfilesInfo } from "./lib/nfcfiles-storage.js";

export async function init() {
    registerCustomElementsDir('@nfaddon/gm/components');

    web.on('POST', '/@nfcfiles/upload', { middleware: ['session', 'auth', 'json'] }, nfcfilesUpload);
    web.on('GET', '/@nfcfiles/download/:fileName', { middleware: [ 'session', 'auth' ]}, nfcfilesDownload);
    web.on('GET', '/@nfcfiles/view/:fileName', { middleware: [ 'session' ]}, (ctx) => nfcfilesDownload(ctx,true));
    web.on('POST', '/@nfcfiles/info/:fileName', { middleware: [ 'session', 'auth' ]}, nfcfilesInfo);
}
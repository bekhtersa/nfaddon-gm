import asyncBusboy from 'async-busboy';
import path from 'path';
import fs from 'fs';
import crypto from "crypto";
import { dbapi } from "@nfjs/back";
import { api, common, config } from "@nfjs/core";
import gm from 'gm';

const _DIR_ = 'uploads';
const units = common.getPath(config, '@nfaddon/gm.units') || {};
export async function upload(context) {
    let filenameSave, saveTo, isImage;
    let gmResolve, gmReject;
    let gmWait = new Promise((r,j)=>{
        gmResolve = r;
        gmReject = j;
    });
    const {files, fields} = await asyncBusboy(context.req, {
        onFile: function (fieldname, file, filename, encoding, mimetype) {
            isImage = mimetype?.split('/')?.[0] === 'image';
            crypto.pseudoRandomBytes(16, (err, raw) => {
                const hex = raw.toString('hex');
                const destination = path.join(process.cwd(),_DIR_,hex.substring(0, 2),hex.substring(2, 4));
                filenameSave = `${hex}.${filename}`;
                saveTo = path.join(destination, filenameSave);

                fs.promises.mkdir(destination, { recursive: true }).then(async () => {
                    file._filename = hex;
                    context.fileStream = file;
                    file.pipe(fs.createWriteStream(saveTo));
                    const org_id = context.session.get('context.org');

                    try {
                        let res = await dbapi.broker(
                            'nfc.files.add',
                            {
                                org_id: org_id,
                                originalname: filename,
                                encoding: encoding,
                                mimetype: mimetype,
                                filesize: context.req.headers['content-length'],
                                destination: saveTo,
                                filename: file._filename,
                                user_id: null,
                            },
                            {
                                context: context
                            }
                        );
                        await gmWait;
                        context.send(JSON.stringify({
                                hash: file._filename,
                                id: res.data.id
                        }));              
                    }
                    catch(error) {
                        fs.unlinkSync(saveTo);
                        const err = api.nfError(error, error.message);
                        context.send(err.json());
                    }
                });
            });
        }
    });

    if(fields?.unit && units[fields.unit] && isImage){
        const cfg = units[fields.unit];
        const destination = path.join(process.cwd(),_DIR_,fields.unit,filenameSave.substring(0, 2),filenameSave.substring(2, 4));

        fs.promises.mkdir(destination, { recursive: true }).then(async () => {
            try {
                for(let [s, i] of Object.entries(cfg.size)){
                    let conv = gm(saveTo)
                    .resize(i.width, i.height, i.options).stream();
                    
                    let w = i.width, h = i.height, x = 0, y = 0;
                    if(i.center){
                        let resolve, reject;
                        let waiter = new Promise((r, j) => {
                            resolve = r;
                            reject = j;
                        })
                        conv = gm(conv).size((e, sz)=>{
                            if(e){
                                console.error(e);
                                reject(e);
                                return;
                            }
                            x = sz.width > i.width ? Math.floor((sz.width - i.width) / 2):0;
                            y = sz.height > i.height ? Math.floor((sz.height - i.height) / 2):0;
                            resolve();
                        }).stream();
                        await waiter;
                    }

                    if(i.crop){
                        conv = gm(conv).crop(w,h,x,y).stream();
                    }
                    const fn = path.join(destination, `${s}.${filenameSave}`);
                    let resolve, reject;
                    let waiter = new Promise((r, j) => {
                        resolve = r;
                        reject = j;
                    })
                    gm(conv).write(fn, (e) => {
                        if(e){
                            console.error(e);
                            reject(e);
                            return;
                        }
                        resolve();
                    });
                    await waiter;
                
            }
            } catch( e ){
                console.error(e);
                gmReject(e);
            } 
            if(cfg.removeSource) {
                fs.unlinkSync(saveTo);
            }
            gmResolve();
        });
    }else {
        gmResolve();
    }
}

export async function download(context, view) {
    const fileName = context.params.fileName;
    const disposition = view?'inline':'attachment';
    let result;
    if (fileName) {
        const [unit, size, name] = fileName.includes('.') && fileName.split('.') || [null,null,fileName];
        try {
            result = await dbapi.query(
                'select * from nfc.v4files t where t.filename = :filename',
                { filename: name },
                { context: context, provider: 'internal' }
            );
        } catch (e) {
            context.send(new Error(e));
        }

        if (result.data && result.data[0]) {
            let file = result.data[0];

            if (file.mimetype) {
                context.type('Content-Type', file.mimetype);
            }
            const headers = {
                'Content-Disposition': `${disposition}; filename=${encodeURIComponent(file.originalname)}`,
                'Content-Transfer-Encoding': 'binary'
            }
            context.headers(headers);

            try {
                let filedestination = file.destination;
                let isImage = file.mimetype?.split('/')?.[0] === 'image';

                if(unit && size && isImage) {
                    filedestination = path.join(process.cwd(),_DIR_,unit,file.filename.substring(0, 2),file.filename.substring(2, 4),`${size}.${file.filename}.${file.originalname}`);
                }
                await fs.promises.stat(filedestination);
                const rs = fs.createReadStream(filedestination);
                context.send(rs);
            } catch (err) {
                context.code(404);
            }
        } else {
            context.code(404);
        }
    } else {
        context.code(404);
    }
}
export async function info(context) {
    const fileName = context.params.fileName;
    if (fileName) {
        const name = fileName.includes('.') && fileName.split('.').at(-1) || fileName;
        try {
            let res = await dbapi.query(
                'select * from nfc.v4files t where t.filename = :filename',
                { filename: name },
                { context: context, provider: 'internal' }
            );
            res = res?.data?.[0];
            context.send(JSON.stringify({
                name: res.originalname,
                type: res.mimetype,
                size: res.filesize,
                progress: 100,
                loaded: res.filesize,
                value:  {
                    hash: res.filename,
                    id: res.id
                }
            })); 
            return;
        } catch (e) {
            context.send(new Error(e));
        }
    }
    context.send(new Error('File not found'));
}
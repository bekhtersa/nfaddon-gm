import asyncBusboy from 'async-busboy';
import path from 'path';
import fs from 'fs';
import crypto from "crypto";
import { dbapi } from "@nfjs/back";
import { api, common, config } from "@nfjs/core";
import gm from 'gm';

const units = common.getPath(config, '@nfaddon/gm.units') || {};
export async function upload(context) {
    let pathSave, filenameSave;
    const {files, params} = await asyncBusboy(context.req, {
        onFile: function (fieldname, file, filename, encoding, mimetype) {
            crypto.pseudoRandomBytes(16, (err, raw) => {
                const hex = raw.toString('hex');
                const destination = `uploads/${hex.substr(0, 2)}/${hex.substr(2, 2)}/`;
                pathSave = path.join(process.cwd(), destination);
                filenameSave = filename;
                const saveTo = path.join(pathSave, filenameSave);

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
    debugger;
    if(params?.unit && units[params.unit]){
        const cfg = units[params.unit];
        const destination = path.join(pathSave, params.unit);

        fs.promises.mkdir(destination, { recursive: true }).then(async () => {
            for(let {s, i} of cfg.size){
                const conv = gm
                .resize(i.width, i.height, i.options);
                
                let w = i.width, h = i.height, x = 0, y = 0;
                if(i.center){
                    conv.size((sz)=>{
                        x = sz.width > i.width ? Math.floor((sz.width - i.width) / 2):0;
                        y = sz.height > i.height ? Math.floor((sz.height - i.height) / 2):0;
                    })
                }

                if(i.crop){
                    conv = conv.crop(w,h,x,y);
                }
                const fn = path.join(destination, `${s}.${filenameSave}`);
                conv.write(fn);
            }
        });
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
                if(unit && size) {
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
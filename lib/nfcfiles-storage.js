import asyncBusboy from 'async-busboy';
import path from 'path';
import fs from 'fs';
import crypto from "crypto";
import { dbapi } from "@nfjs/back";
import { api, common, config } from "@nfjs/core";

export async function upload(context) {
    const {files, fields} = await asyncBusboy(context.req, {
        onFile: function (fieldname, file, filename, encoding, mimetype) {
            crypto.pseudoRandomBytes(16, (err, raw) => {
                const hex = raw.toString('hex');
                const destination = `uploads/${hex.substr(0, 2)}/${hex.substr(2, 2)}/`;
                const saveTo = path.join(process.cwd(), `${destination}/${filename}`);

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
}

export async function download(context, view) {
    const fileName = context.params.fileName;
    const disposition = view?'inline':'attachment';
    let result;
    if (fileName) {
        const name = fileName.includes('/') && fileName.split('/')[0] || fileName;
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
                await fs.promises.stat(file.destination);
                const rs = fs.createReadStream(file.destination);
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
        const name = fileName.includes('/') && fileName.split('/')[0] || fileName;
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
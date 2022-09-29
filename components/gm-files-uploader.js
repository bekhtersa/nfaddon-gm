import { PlElement, html, css } from "polylib";
import "@plcmp/pl-icon";
import "./gm-files-preview.js";
import { requestData } from "@nfjs/front-pl/lib/RequestServer";

class GMFilesUploader extends PlElement {
    static properties = {
        dragActive: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        multiple: {
            type: Boolean,
            value: false
        },
        files: {
            type: Array,
            value: ()=>([]),
            observer: 'filesChange'
        },
        required: {
            type: Boolean,
            reflectToAttribute: true,
            value: false,
            observer: 'validate'
        },
        invalid: { 
            type: Boolean, 
            value: false 
        },
        file_id: { 
            type: String, 
            value: null, 
            readonly: true 
        },
        file_hash: { 
            type: String, 
            value: null, 
            observer: 'changeFile' 
        },
        unit: { 
            type: String, 
            value: '' 
        },
        accept: {
            type: String
        },
        storage: {
            type: String,
            value: 'nfcfiles'
        },
        hint: {
            type: String,
            value: 'Перетащите файлы или нажмите здесь, чтобы загрузить'
        },
        maxFileSize: { type: Number },
        maxFileCount: { type: Number },
        showPreview: {
            type: Boolean, 
            value: true 
        }
    }

    static css = css`
        :host {
            gap: var(--space-sm);
            max-height: var(--height-uploader, 100%);
            display:flex;
            flex-direction: column;
            flex: 1 1 auto;
            overflow-y: auto;
            min-height: 0px;
            --width-preview: var(--width-uploader, 240px);
        }

        .uploader-container{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: var(--space-lg);
            font: var(--subtext-font);
            max-width: var(--width-uploader, 240px);
            height: 92px;
            border: 1px dashed var(--grey-dark);
            box-sizing: border-box;
            border-radius: var(--border-radius);
            color: var(--grey-dark);
            position: relative;
            cursor: pointer;
        }

        :host([hidden]) .uploader-container{
            display: none !important;
        }

        .uploader-container:hover, :host([drag-active]) .uploader-container{
            background: var(--primary-lightest);
            border: 1px dashed  var(--primary-base);
            color: var(--primary-base);
        }

        .uploader-container::before {
            content: '';
            display: block;
            position: absolute;
            box-sizing: border-box;
            top: 0;
            left: 0;
        }

        :host([required]) .uploader-container::before {
            border-top: calc(var(--space-md) / 2) solid var(--attention);
            border-left: calc(var(--space-md) / 2)  solid var(--attention);
            border-bottom: calc(var(--space-md) / 2) solid transparent;
            border-right: calc(var(--space-md) / 2) solid transparent;
        }
        .uploader-container.valid::before{
            display: none;
        }
        .files {

        }
    `;

    static template = html`
        <div id="uploader" class="uploader-container">
            <input id="fileInput" accept$="[[accept]]" type="file" multiple$="[[multiple]]" on-change="[[onFileInputChange]]" hidden/>
            <pl-icon iconset="pl-default" size="32" icon="upload"></pl-icon>
        
            <span class="hint">[[hint]]</span>
        </div>
        <pl-dom-if if=[[showPreview]]>
            <template>
                <div class="files">
                    <gm-files-preview storage="[[storage]]" can-delete="true" files="{{files}}" unit="[[unit]]"></gm-files-preview>
                </div>
            </template>
        </pl-dom-if>
    `;

    connectedCallback() {
        super.connectedCallback();
        this.$.uploader.addEventListener('click', this.onFileClick.bind(this), false);
        this.$.uploader.addEventListener("dragenter", this.dragenter.bind(this), false);
        this.$.uploader.addEventListener("dragover", this.dragover.bind(this), false);
        this.$.uploader.addEventListener("dragleave", this.dragleave.bind(this), false);
        this.$.uploader.addEventListener("drop", this.drop.bind(this), false);
    }

    filesChange() {
        this.validate();
        this.file_id = this.files?.[0]?.value?.id;
        this.file_hash = this.files?.[0]?.value?.hash;
    }
    async changeFile(file_hash) {
        if (file_hash && file_hash !== this.files?.[0]?.value?.hash) {
            let res = await requestData(`/@${this.storage}/info/`+file_hash,{method: 'POST'});
            let fileInfo = await res.json();
            if(this.files.length === 0) {
                this.push('files', fileInfo);
            }else
                this.set(['files',0],fileInfo);
        }
    }
    validate() {
        if (this.required) {
            let noValue = this.files.find(f => !f.value);
            if (noValue || this.files.length === 0) {
                this.invalid = true;
            } else if(this.files.length > 0){
                this.invalid = false;
            }
        } else this.invalid = false;

        if (this.invalid) {
            this.$.uploader.classList.remove('valid');
        } else {
            this.$.uploader.classList.add('valid');
        }

        this.dispatchEvent(new CustomEvent('validation-changed', { bubbles: true, composed: true }))
    }
    onFileClick() {
        this.$.fileInput.click()
    }

    dragenter(e) {
        e.dataTransfer.dropEffect = 'copy';

        e.stopPropagation();
        e.preventDefault();
    }

    dragleave(e) {
        this.dragActive = false;
        e.stopPropagation();
        e.preventDefault();
    }

    dragover(e) {
        this.dragActive = true;
        e.stopPropagation();
        e.preventDefault();
    }

    drop(e) {
        this.dragActive = false;
        e.stopPropagation();
        e.preventDefault();
        let dt = e.dataTransfer;
        let files = dt.files;

        for (let i = 0; i < dt.files.length; i++) {
            const file = dt.files[i];
            if (!this.acceptFile(file, this.accept)) {
                return false;
            }
        }
        this.handleFiles(files);
    }

    onFileInputChange(e) {
        let files = e.target.files;
        this.handleFiles(files);
    }

    acceptFile(file, acceptedFiles) {
        if (file && acceptedFiles) {
            let acceptedFilesArray = Array.isArray(acceptedFiles) ? acceptedFiles : acceptedFiles.split(',');
            let fileName = file.name || '';
            let mimeType = (file.type || '').toLowerCase();
            let baseMimeType = mimeType.replace(/\/.*$/, '');
            return acceptedFilesArray.some(function (type) {
                let validType = type.trim().toLowerCase();

                if (validType.charAt(0) === '.') {
                    return fileName.toLowerCase().endsWith(validType);
                } else if (validType.endsWith('/*')) {
                    return baseMimeType === validType.replace(/\/.*$/, '');
                }

                return mimeType === validType;
            });
        }

        return true;
    }

    handleFiles(uploadedFiles) {
        //TODO: remove already uploaded files from server
        if (!this.multiple) this.set('files', []);
        let skipped = 0;
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            if (file.size > this.maxFileSize) {
                document.dispatchEvent(new CustomEvent('error', { detail: {
                    message: `Размер файла "${file.name}" превышает максимальный размер.`
                } }));
                console.log(i,file)
                continue;
            }
            if (this.files.length >= this.maxFileCount) {
                skipped++;
                continue;
            }
            file.loaded = 0;
            file.progress = 0;
            file.value = '';
            this.push('files', file);
            this.uploadFile(file);
        }
        this.$.fileInput.value = '';
        if (skipped) {
            document.dispatchEvent(new CustomEvent('error', { detail: {
                    message: `Превышено максимальное количество файлов (${this.maxFileCount}). Часть файлов не загружена (${skipped}).`
                } }));
        }
    }

    uploadFile(file) {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        const url = `/@${this.storage}/upload`;
        file._xhr = xhr;
        formData.append('file', file, file.name);
        formData.append('unit', this.unit);
        xhr.upload.onprogress = (event) => {
            const done = event.loaded;
            const total = event.total;
            const progress = Math.floor((done / total) * 1000) / 10;
            const idx = this.files.indexOf(file);
            this.set(`files.${idx}.loaded`, done);
            this.set(`files.${idx}.progress`, progress);
        };

        xhr.open('POST', url, true);
        xhr.onload = (event) => {
            delete file._xhr;
            if (event.target.status === 200) {
                const resp = JSON.parse(event.target.response);
                if (resp.id) {
                    const idx = this.files.indexOf(file);
                    this.set(`files.${idx}.value`, resp);
                } else {
                    if(resp.error) {
                        const idx = this.files.indexOf(file);
                        this.splice('files', idx, 1);
                        document.dispatchEvent(new CustomEvent('error', { detail: { message: resp.error } }));
                    }
                }
            } else {
                let message = event.target.statusText;
                switch(event.target.status){
                    case 413: 
                            message = 'Превышен максимальный размер данных для отправки на сервер.';
                        break;
                }
                const idx = this.files.indexOf(file);
                this.splice('files', idx, 1);
                document.dispatchEvent(new CustomEvent('error', { detail: { message } }));
            }
        };
        xhr.send(formData);
    }
}

customElements.define('gm-files-uploader', GMFilesUploader);

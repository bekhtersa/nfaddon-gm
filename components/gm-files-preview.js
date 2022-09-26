import { PlElement, html, css } from "polylib";
import { requestData } from "@nfjs/front-pl/lib/RequestServer";
import "@plcmp/pl-icon";
const host = import.meta.url.match(/^[a-z]+:\/\/[^\/]+/i)?.[0] ?? '';

class GMFilesPreview extends PlElement {
    static properties =  {
        files: {
            type: Array,
            value: ()=>([]),
            observer: 'filesChange'
        },
        canDelete: {
            type: Boolean,
            value: false
        },
        storage: {
            type: String,
            value: 'nfcfiles'
        }
    }

    static css = css`
        :host{
            max-height: 100%;
            gap: 8px;
            display: block;
            overflow: auto;
        }

        .cont {
            max-width: var(--width-preview, 240px);
            display:flex;
            flex-direction:column;
            box-sizing: border-box;
            border: 1px solid var(--grey-base);
            border-radius: var(--border-radius);
            position: relative;
            overflow: hidden;
        }

        .file-info-container {
            display:flex;
            flex-direction:row;
            justify-content:space-between;
            width: 100%;
            height: 100%;
            gap: 4px;
        }

        .img {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            background: var(--grey-lightest);
            height: 48px;
        }

        .progress {
            position: absolute;
            bottom: 0;
        }

        progress {
            width: 100%;
            height: 4px;
            background: var(--primary-base);
        }

        progress::-webkit-progress-value { background: var(--primary-base); }
        progress::-moz-progress-bar { background: var(--primary-base); }
        progress[value]::-webkit-progress-bar {
            background-color: var(--grey-light);
            border-radius: var(--border-radius);
            }
            

        .data-container {
            display: flex;
            flex-direction: column;
            flex: 1 1 0;
            justify-content: center;
            gap: 4px;
            overflow: hidden;
            white-space: nowrap;
        }

        .name {
            font: var(--text-font);
            color: var(--text-color);
            text-overflow: ellipsis;
            overflow: hidden;
        }

        .size {
            color: var(--grey-dark);
            font: var(--subtext-font);
        }

        .tools {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 4px;
        }
        .image_preview {
            display: none;
            width: 100%;
            height: auto;
        }
        [type="image"] {
            height: auto;
        }
        [type="image"] .file-info-container{
            display: grid;
            grid-template: 
            "image image"
            "name tools";
            padding-bottom: 8px;
            gap: 0;
        }
        [type="image"] .file-info-container .img{
            grid-area: image;
            height: auto;
            width: auto;
        }
        [type="image"] .file-info-container .img pl-icon{
            display: none;
        }
        [type="image"] .file-info-container .img .image_preview{
            display: block;
            width: calc(var(--width-preview, 240px) - 2px);
        }
        [type="image"] .file-info-container .data-container{
            grid-area: name;
            margin-left: 8px;
            width: calc(var(--width-preview, 240px) - 74px);
            overflow: visible;
            white-space: normal;
            margin-right: 0;
            margin-top: 4px;
        }
        [type="image"] .file-info-container .tools{
            grid-area: tools;
            width: 64px;
            margin-right: 0;
            justify-content: flex-start;
        }
    `;

    static template = html`
        <template d:repeat="[[files]]">
            <div class="cont" type$="[[getType(item.type)]]">
                <div class="file-info-container" title="[[item.name]]">
                    <div class="img">
                        <img class="image_preview" src$="[[getImageSrc(item.value, item.type)]]" alt="[[item.name]]"/>
                        <pl-icon iconset="pl-default" size="16" icon="file"></pl-icon>
                    </div>
                    <div class="data-container">
                        <div class="name">
                            [[item.name]]
                        </div>
                        <div class="size">[[getFileSize(item.value, item.loaded, item.size)]]</div>
                    </div>
                    <div class="tools">
                        <pl-icon-button hidden="[[!canDelete]]" variant="link" iconset="pl-default" size="16" icon="close"
                            on-click="[[onCloseClick]]"></pl-icon-button>
                        <pl-icon-button hidden="[[!item.value]]" variant="link" iconset="pl-default" size="16"
                            icon="download" on-click="[[onDownloadClick]]"></pl-icon-button>
                    </div>
                </div>
                <progress hidden="[[item.value]]" class="progress" max="100" value="[[item.progress]]"></progress>
            </div>
        </template>
    `;

    filesChange() {
        this.files.forEach(async (file) => {
            if (!file.value?.id && file.value?.hash) {
                let res = await requestData(`/@${this.storage}/info/`+file.value?.hash,{method: 'POST'});
                let fileInfo = await res.json();
                const indx = this.files.indexOf(file);
                this.set(['files',indx], fileInfo);
            }
        })
    }

    getType(type) {
        return type.split('/')?.[0]??'file';
    }

    getImageSrc(value, type) {
        const isImage = type.split('/')?.[0] === 'image';
        return isImage && value?`${host}/@${this.storage}/view/${value.hash}`:'';
    }

    onDownloadClick(event) {
        const link = document.createElement("a");
        link.target = "_blank";

        // Construct the URI
        link.href = `${host}/@${this.storage}/download/${event.model.item.value.hash}`;
        document.body.appendChild(link);
        link.click();

        // Cleanup the DOM
        document.body.removeChild(link);
    }

    getFileSize(value, loaded, size) {
        if (value) {
            return `${(loaded / 1024).toFixed(2)} KB`;
        }
        return loaded && size ? `${(loaded / 1024).toFixed(2)} KB / ${(size / 1024).toFixed(2)} KB` : '';
    }

    onCloseClick(event) {
        if(event.model.item._xhr) {
            event.model.item._xhr.abort();
        }
        //TODO: remove already uploaded files from server
        this.splice('files', this.files.findIndex( x => x === event.model.item), 1);
    }
}

customElements.define('gm-files-preview', GMFilesPreview);

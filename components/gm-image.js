import { PlElement, html, css } from "polylib";
import "@plcmp/pl-icon";
const host = import.meta.url.match(/^[a-z]+:\/\/[^\/]+/i)?.[0] ?? '';

class GMImage extends PlElement {
    static properties =  {
        filename: {
            type: String,
            value: null
        },
        unit: {
            type: String,
            value: ''
        },
        size: {
            type: String,
            value: 'default'
        },
        storage: {
            type: String,
            value: 'nfcfiles'
        }
    }

    static css = css`
        :host{
            display: flex;
        }
        img {
            width: 100%;
        }
    `;
    static template = html`
        <img src="[[url(filename, unit, size, storage)]]" />
    `;

    url(filename,unit,size,storage) {
        return filename?`${host}/@${storage}/view/${ (unit && size) ? `${unit}.${size}.` : '' }${filename}`:'';  
    }
}

customElements.define('gm-image', GMImage);
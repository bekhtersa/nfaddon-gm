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
    `;
    static template = html`
        <img src="[[url(filename, unit, size, storage)]]" />
    `;

    url(filename,unit,storage) {
        return filename?`${host}/@${storage}/view/${ (unit && size) ? `${unit}.${size}.` : '' }${filename}`:undefined;  
    }
}

customElements.define('gm-image', GMImage);
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
        },
        bg: {
            tyep: Boolean,
            value: false
        }
    }

    static css = css`
        :host{
            display: flex;
            background-size: cover;
        }
        img {
            width: 100%;
        }
        img[hidden] {
            display: none;
        }
    `;
    static template = html`
        <img src="[[url(filename, unit, size, storage)]]" hidden$="[[bg]]"/>
    `;

    url(filename,unit,size,storage) {
        const url = filename?`${host}/@${storage}/view/${ (unit && size) ? `${unit}.${size}.` : '' }${filename}`:'';
        this.style.backgroundImage = `url('${url}')`;
        return url;
    }
}

customElements.define('gm-image', GMImage);
# @nfaddon/gm

File Uploader and Viewer for NF-Framework using GraphicsMagick for sizing images.

Components

```html
<gm-files-uploader></gm-files-uploader>
<gm-files-preview></gm-files-preview>
<gm-image></gm-image>
```

Config
```json
    "@nfaddon/gm": {
        "units": {
          "coupon": {
            "removeSource": "true",
            "size": {
              "list": {"width": 200, "height": 150, "options": "^", "crop": true, "center": true},
              "card": {"width": 480, "height": 320}
            }
          }
        }
    }
```
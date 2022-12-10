![Logo](admin/artnetdmx.png)
# ioBroker.artnetdmx

[![NPM version](https://img.shields.io/npm/v/iobroker.artnetdmx.svg)](https://www.npmjs.com/package/iobroker.artnetdmx)
[![Downloads](https://img.shields.io/npm/dm/iobroker.artnetdmx.svg)](https://www.npmjs.com/package/iobroker.artnetdmx)
![Number of Installations](https://iobroker.live/badges/artnetdmx-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/artnetdmx-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.artnetdmx.png?downloads=true)](https://nodei.co/npm/iobroker.artnetdmx/)

**Tests:** ![Test and Release](https://github.com/ChriD/ioBroker.artnetdmx/workflows/Test%20and%20Release/badge.svg)

## artnetdmx adapter for ioBroker

With this adapter you can control DMX devices via an ARTNET node.



Art-Net™ Designed by and Copyright Artistic Licence Holdings Ltd"


## Getting started

* For a stable version install the adapter with the iobroker adapter manager or for development branches with the latest features use the advanged git-hub installation method `(not recommended)`

* Set the artnet settings in the adapter to connect to a ARTNET node device
    * Connection settings
        | Field | Description |
        |-------------|-------------|
        | `Node IP` | The ip of your artnet node (artnet to dmx) |
        | `Port` | The port of the artnet node `default: 6454` |
        | `Local IPv4 network interface` | The interface which should be used for network connection |
    * Artnet/DMX Settings
        | Field | Description |
        |-------------|-------------|
        | `Universe` | the dmx universe which should be talked to `default: 0` |
        | `Net` | the dmx net which should be talked to `default: 0` |
        | `Subnet` | the dmx subnet which should be talked to `default: 0` |  
        | `Frames [per sec]` | The FPS with which the dmx values are updated `default (maxium fps): 44`<br> This rate only applies if there are value changes pending, otherwise the values are beeing refreshed periodically with the `Refresh period [ms]` period |  
        | `Refresh period [ms]` | The period where all dmx values are beeing sent in a bulk, even if there is no value change on a channel<br>This is needed because there are artnet nodes wich do rely on refreshing the whole dmx channel values every x seconds |  
        | `Default fade time [ms]` | The default fadeing time which is used when setting a channel value |  

* Define devices in the adapter settings



### Publishing the adapter
Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:
```bash
npm run release
```
Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually on a local ioBroker installation
In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
    ```bash
    npm pack
    ```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
    ```bash
    cd /opt/iobroker
    npm i /path/to/tarball.tgz
    ```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.artnetdmx`)
1. Execute `iobroker upload artnetdmx` on the ioBroker host


## **WORK IN PROGRESS**

-   multilanguage (english & german)

## Changelog

### 1.0.0 (2022-12-10)

-   (ChriD) initial version


## License
MIT License

Copyright (c) 2022 ChriD <chris_d85@hotmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

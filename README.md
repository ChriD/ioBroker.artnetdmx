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


### Getting started

* Install the adapter within the iobroker adapter manager dor a stable version or use the advanged git-hub installation method
to get development branches

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
        | `Universe` |  |
        | `Net` |  |
        | `Subnet` |  |  
        | `Frames [per sec]` | The FPS with which the dmx values are updated `default (maxium fps): 44`<br> This rate only applies if there are value changes pending, otherwise the values are beeing refreshed periodically with the `Refresh period [ms]` period |  
        | `Refresh period [ms]` | The period where all dmx values are beeing sent in a bulk, even if there is no value change on a channel<br>This is needed because there are artnet nodes wich do rely on refreshing the whole dmx channel values every x seconds |  
        | `Default fade time [ms]` | The default fadeing time which is used when setting a channel value |  
        | `Update dmx values on adapter startup` | If this is set, the adapter will update/refresh the stored device values when the adapter was started.<br>This setting should always be on yes `default: yes` |

* Define devices in the adapter settings


### Scripts in `package.json`
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `test:js` | Executes the tests you defined in `*.test.js` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `translate` | Translates texts in your adapter to all required languages, see [`@iobroker/adapter-dev`](https://github.com/ioBroker/adapter-dev#manage-translations) for more details. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Writing tests
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

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

## Changelog

### **WORK IN PROGRESS**
* (ChriD) initial release

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

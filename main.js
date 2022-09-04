'use strict';

/*
 * Created with @iobroker/create-adapter v2.2.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");

class Artnetdmx extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'artnetdmx',
        });

        this.deviceSettings = [];

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async buildDeviceSettings()
    {
        return new Promise((_resolve, _reject) => {
            this.getDevices(async (_err, _devices) => {
                if(_err)
                {
                    _reject(_err);
                }
                {
                    try
                    {
                        for (const device of _devices)
                        {
                            this.log.warn(JSON.stringify(device));
                            this.getStates(device._id + '.settings.*', (_err, _states) => {

                                let settingsObject = {};
                                for (const [key, state] of Object.entries(_states)){
                                    this.log.warn(key);
                                    this.log.warn(state);
                                    //console.log(`${key}: ${state}`);
                                    //settingsObject[key.split('.').pop()] = state.val;
                                }

                                this.deviceSettings.push({
                                    'id' : device._id,
                                    'name' : device.common.name,
                                    'settings' : settingsObject
                                });

                                this.log.warn(JSON.stringify(this.deviceSettings));
                            });
                        }
                    }
                    catch (err)
                    {
                        this.log.error(JSON.stringify(err));
                    }
                    _resolve();
                }
            });
         });
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        
        

        // Initialize your adapter here

        // Subscribe to every state and fill internal state info object for the devices

        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('config option1: ' + this.config.option1);
        this.log.info('config option2: ' + this.config.option2);
        


        // TEST: @@@

        // TODO: channel     
        


        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
    

        await this.setObjectNotExistsAsync('lights.Kitchen', {
            type: 'device',
            common: {
                name: 'Kitchen Light Surroundings'                
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('lights.Kitchen.settings', {
            type: 'channel',
            common: {
                name: 'Settings'                
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('lights.Bedrom', {
            type: 'device',
            common: {
                name: 'Bedroom Main Light'                
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('lights.Bedrom.settings', {
            type: 'channel',
            common: {
                name: 'Settings'                
            },
            native: {},
        });


        await this.setObjectNotExistsAsync('lights.Kitchen.settings.fadeTime', {
            type: 'state',
            common: {
                name: 'fadeTime',
                type: 'number',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('lights.Bedrom.settings.fadeTime', {
            type: 'state',
            common: {
                name: 'fadeTime',
                type: 'number',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });




        // build device settings object for the admin page (the device list will be created from the devices 
        // in the object list)
        await this.buildDeviceSettings();


        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        //this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
       // await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw iobroker: ' + result);

        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
     onObjectChange(id, obj) {
         if (obj) {
             // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
         } else {
             // The object was deleted
             this.log.info(`object ${id} deleted`);
         }
     }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }


     // New message arrived. obj is array with current messages
    // triggered from admin page read in knx project
    onMessage(obj) {
        this.log.info('incoming message');
        if (typeof obj === 'object') {
            switch (obj.command) {
                case 'message':
                /*
                let selector = $('artnetdmx.0.lights.*'); 
                    selector.each(function (id, i) {
                        this.log.info(id);
                    });
                    */
                    //https://github.com/ioBroker/ioBroker.simple-api/blob/master/lib/simpleapi.js
                    // this.getForeignStates()

                    //https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md
                    //getDevices(**)
                    // -> getStates()
        


                            if (obj.callback) {
                                this.sendTo(obj.from, obj.command, { 'test' : 'this is a test' }, obj.callback);
                            }
                    break;            
            }
        }
        return true;
    }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Artnetdmx(options);
} else {
    // otherwise start the instance directly
    new Artnetdmx();
}
'use strict';

/*
 * Created with @iobroker/create-adapter v2.2.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { threadId } = require('worker_threads');

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

    async buildDeviceSettingsFromAdapterObjects()
    {
        try
        {
            this.deviceSettings = [];

            const devices = await this.getDevicesAsync();
            for (const device of devices)
            {
                const states = await this.getStatesAsync(device._id + '.settings.*');
                const settingsObject = {};
                for (const [key, state] of Object.entries(states)){
                    settingsObject[key.split('.').pop()] = state ? state.val : null;
                }

                this.deviceSettings.push({
                    'id' : device._id,
                    'deviceId' : (device._id).split('.').pop(),
                    'name' : device.common.name,
                    'settings' : settingsObject
                });

                //this.log.warn(JSON.stringify(this.deviceSettings));
            }
        }
        catch(_error)
        {
            this.log.error(_error.message);
        }
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
    

        



        // build device settings object for the admin page (the device list will be created from the devices in the object list)
        // the admin page will show the devices defined in the object list and the values of the settings given in the "settings"
        // channel of the device
        await this.buildDeviceSettingsFromAdapterObjects();

        // subscribe to all 'settings' states in the adapter
        this.subscribeStates('*');


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

        // TODO: @@@ If a "settings" state was changed we do update the deviceSettings for the admin gui

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
    onMessage(_obj)
    {
        this.handleMessages(_obj);
        return true;
    }

    async handleMessages(_obj)
    {
        //this.log.warn(JSON.stringify(_obj));

        if (typeof _obj === 'object'){
            switch (_obj.command) {
                case 'requestDeviceSettings':
                    if (_obj.callback) {
                        this.sendTo(_obj.from, _obj.command, this.deviceSettings, _obj.callback);
                    }
                    break;

                case 'updateDeviceSettings':
                    //this.log.warn(JSON.stringify(_obj));
                    for (const deviceSetting of _obj.message){
                        await this.addOrUpdateDevice(deviceSetting);
                    }

                    await this.buildDeviceSettingsFromAdapterObjects();

                    if (_obj.callback) {
                        this.sendTo(_obj.from, _obj.command, {}, _obj.callback);
                    }
                    break;
            }
        }
    }


    async addOrUpdateDevice(_device)
    {
        // 	{"id":"artnetdmx.0.lights.Bedrom","deviceId":"Bedrom","name":"Bedroom Main Light","settings":{"fadeTime":150}}
        this.log.warn(JSON.stringify(_device));

        await this.setObjectHelper('lights.' + _device.deviceId, _device.name, 'device');
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings', 'settings', 'channel');
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel', 'channel', 'channel');

        for (const [key, value] of Object.entries( _device.settings)) {
            if(typeof value !== 'object' || value === null)
            {
                await this.setObjectHelper('lights.' + _device.deviceId + '.settings' + '.' + key, key, 'state', 'number');
                await this.setStateAsync('lights.' + _device.deviceId + '.settings' + '.' + key, { val: value, ack: true });
            }
        }

        for (const [key, value] of Object.entries( _device.settings.channels)) {
            await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel' + '.' + key, key, 'state', (key == 'type') ? 'string' : 'number');
            await this.setStateAsync('lights.' + _device.deviceId + '.settings.channel' + '.' + key, { val: value, ack: true });
        }

        // TODO: clear devices not in settings (do by parameter)

    }

    async setObjectHelper(_id, _name, _type, _stateType)
    {
        const objectContainer = {
            type: _type,
            common: {
                name: _name
            },
            native: {},
        };

        if(_stateType)
        {
            objectContainer.common.type = _stateType;
            objectContainer.common.role = 'state';
            objectContainer.common.read = true;
            objectContainer.common.write = true;
        }
        //this.log.warn(JSON.stringify(objectContainer));
        await this.setObjectNotExistsAsync(_id, objectContainer);
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
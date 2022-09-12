'use strict';

/*
 * Created with @iobroker/create-adapter v2.2.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { KeyObject } = require('crypto');
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

    getStateValueFromStatesObject(_object, path, _key, _defaultValue)
    {
        const fullKey = path ? (path + '.' + _key) : _key;
        if(_object[fullKey])
            return _object[fullKey].val;
        return _defaultValue;
    }

    async buildDeviceSettingsFromAdapterObjects()
    {
        try
        {            
            this.deviceSettings = [];

            const deviceObjects = await this.getDevicesAsync();
            for (const deviceObject of deviceObjects)
            {
                const statePathDeviceSettings = deviceObject._id + '.settings';
                const settingsStates = await this.getStatesAsync(statePathDeviceSettings + '.*');

                const device = {};
                device.settings = {};
                device.settings.channel = {};

                device.id = deviceObject._id;
                device.deviceId = (deviceObject._id).split('.').pop();
                device.name = deviceObject.common.name;

                device.settings.fadeTime = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings, 'fadeTime', 0);
                device.settings.type = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings,'type', '');
                device.settings.channel.main = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings, 'channel.main', null);
                device.settings.channel.red = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings, 'channel.red', null);
                device.settings.channel.green = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings,'channel.green', null);
                device.settings.channel.blue = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings, 'channel.blue', null);
                device.settings.channel.white = this.getStateValueFromStatesObject(settingsStates, statePathDeviceSettings, 'channel.white', null);

                this.deviceSettings.push(device);

                // TODO: @@@ does return states within channel too, maybe ist better do this fixed?
                /*
                const states = await this.getStatesAsync(device._id + '.settings.*');
                const settingsObject = {};
                for (const [key, state] of Object.entries(states)){
                    settingsObject[key.split('.').pop()] = state ? state.val : null;
                }

                this.deviceSettings.push({
                    'id' : deviceObject._id,
                    'deviceId' : (deviceObject._id).split('.').pop(),
                    'name' : deviceObject.common.name,
                    'settings' : settingsObject
                });

                //this.log.warn(JSON.stringify(this.deviceSettings));
                */
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
                case 'formatObjectId':
                    if (_obj.callback) {
                        this.log.error(_obj.message);
                        this.log.error(this.FORBIDDEN_CHARS.toString());
                        const validObjectId = _obj.message.toString().replace(this.FORBIDDEN_CHARS, '_');
                        this.log.error(validObjectId);
                        validObjectId.replace(/[\.\s\/]/g, '_');
                        this.log.error(validObjectId);
                        this.sendTo(_obj.from, _obj.command, validObjectId, _obj.callback);
                    }
                    break;

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

                    // TODO: clear devices not updated!

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
        // TODO: make manual not dynamic?!
        // 	{"id":"artnetdmx.0.lights.Bedrom","deviceId":"Bedrom","name":"Bedroom Main Light","settings":{"fadeTime":150}}
        //this.log.warn(JSON.stringify(_device));

        // main device and channel objects
        await this.setObjectHelper('lights.' + _device.deviceId, _device.name, 'device');
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings', 'settings', 'channel');
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel', 'channel', 'channel');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values', 'values', 'channel');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.channel', 'channel', 'channel');

        // overall settings
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.fadeTime', 'fadeTime', 'state', 'number', _device.settings.fadeTime);
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.type', 'type', 'state', 'string', _device.settings.type);

        // channels
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel.main', 'main', 'state', 'number', _device.settings.channel.main, true);
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel.red', 'red', 'state', 'number', _device.settings.channel.red, true);
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel.green', 'green', 'state', 'number', _device.settings.channel.green, true);
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel.blue', 'blue', 'state', 'number', _device.settings.channel.blue, true);
        await this.setObjectHelper('lights.' + _device.deviceId + '.settings.channel.white', 'white', 'state', 'number', _device.settings.channel.white, true);

        // values
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.isOn', 'isOn', 'state', 'boolean');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.brightness', 'brightness', 'state', 'number');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.channel.main', 'main', 'state', 'number');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.channel.red', 'red', 'state', 'number');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.channel.green', 'green', 'state', 'number');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.channel.blue', 'blue', 'state', 'number');
        await this.setObjectHelper('lights.' + _device.deviceId + '.values.channel.white', 'white', 'state', 'number');
    }

    async setObjectHelper(_id, _name, _type, _stateType, _value, _deleteNullValue = false)
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

        if(_stateType)
        {
            if(_deleteNullValue && !_value)
            {
                await this.delStateAsync(_id);
                await this.delObjectAsync(_id);
            }
            else
            {
                await this.setStateAsync(_id, { val: this.convertValue(_value, _stateType), ack: true });
            }
        }
    }


    convertValue(_value, _type)
    {
        let converted;

        if(_value === null)
            return _value;

        switch(_type)
        {
            case 'string':
                converted = _value.toString();
                break;
            case 'number':
                converted = Number(_value);
                break;
            default:
                converted = _value;
        }
        return converted;
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
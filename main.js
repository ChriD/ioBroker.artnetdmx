/*
    TODO:
    * adapter checker (https://adapter-check.iobroker.in/)
    * (https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices)
    * multilanguage (https://forum.iobroker.net/topic/36660/trial-weblate-f%C3%BCr-iobroker-%C3%BCbersetzungen/9)
    * testscripts (iobroker)
    * !!! TESTING !!!
    * publish adapter
*/

'use strict';

const utils = require('@iobroker/adapter-core');
const path = require('node:path');
const ArtnetActionBuffer = require(path.resolve( __dirname, './lib/artnetActionBuffer/artnetActionBuffer'));
const SetObjectValue = require(path.resolve( __dirname, './lib/setObjectValue.js'));
const GetObjectValue = require(path.resolve( __dirname, './lib/getObjectValue.js'));


const DATATYPE = {
    BOOLEAN: 'boolean',
    NUMBER: 'number',
    STRING: 'string',
    JSON: 'json',
};

const DEVICETYPE = {
    DIMMABLE: 'dimmable',
    TW: 'TW',
    RGB: 'RGB',
    RGBW: 'RGBW',
    RGBTW: 'RGBTW'
};


class Artnetdmx extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'artnetdmx',
        });

        this.devices = [];
        this.deviceMap = {};
        this.artnetActionBuffer = null;

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * onReady is called when databases are connected and adapter received configuration
     */
    async onReady() {
        // Reset the connection indicator during startup
        // The connection state of an Artnet connection is not really detectable because it used UDP
        this.setState('info.connection', false, true);

        // whenever the adapter is restarting we create/update the artnet devices in the object tree
        // it will add/remove the devices or update the data in the settings folder
        await this.updateArtnetDevices();

        // set the configuration values for the artnet action buffer from the adapter configuration
        const artnetConfiguration = {
            host: this.config.nodeip,
            port: this.config.nodeport,
            universe: this.config.universe,
            net: this.config.net,
            subnet: this.config.subnet,
            localInterface: this.config.localInterface,
            framesPerSec: this.config.framesPerSec,
            refresh: this.config.fullRefreshPeriod
        };

        // setup the artnet action buffer which will do the connection and action handling for us
        this.artnetActionBuffer = new ArtnetActionBuffer(artnetConfiguration);
        this.artnetActionBuffer.on('connectionStateChanged', (_connected) => {
            this.setState('info.connection', _connected, true);
        });
        this.artnetActionBuffer.on('error', (_exception) => {
            this.log.error(_exception.message);
        });
        this.artnetActionBuffer.on('bufferChanged', (_idx) => {
            this.log.info(JSON.stringify(this.artnetActionBuffer.bufferAction));
        });

        // be sure the action buffer does have the same values as given in the iobroker object store,
        // otherwise after an adapter restart the lights will all go out because the action buffer channel
        // value cache was deleted
        this.setArtnetActionBufferByDeviceData();

        // after the artnet buffer was synced with the current device values we can start transimitting the values
        this.artnetActionBuffer.startBufferUpdate();

        // subscribe to all states in the lights object because we want some kind of cached state in this adapter
        this.subscribeStates('lights.*');
    }

    /**
     * This method will update the action buffer of the underlaying artnet library.
     * This is necessary after a restart of the adapter to get the artnet buffer in sync with the object values
     * @param {string} _transmitValues if set the values will be forced to directly update the artnet values
     */
    setArtnetActionBufferByDeviceData(_transmitValues = false)
    {
        const buffer = new Array(512).fill(0);
        for(let idx=0; idx<this.devices.length; idx++)
        {
            const deviceObject = this.devices[idx];
            for (const [objKey, objValue] of Object.entries(deviceObject.settings.channel))
            {
                if(objValue)
                {
                    const channelValue = deviceObject.values.channel[objKey];
                    if(typeof objValue === DATATYPE.NUMBER && !Number.isNaN(objValue) &&
                       typeof channelValue === DATATYPE.NUMBER && !Number.isNaN(channelValue))
                    {
                        buffer[objValue] = channelValue;
                    }
                    else
                    {
                        this.log.warn(`Trying to set a value to the artnet buffer which is not a number on device ${deviceObject.deviceId}`);
                    }
                }
            }
        }
        this.artnetActionBuffer.setBuffer(buffer);
        if(_transmitValues)
            this.artnetActionBuffer.transmitValues();
        this.log.debug(`Set cache buffer of artnet transmiter to: ${JSON.stringify(buffer)}`);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            if(this.artnetActionBuffer)
                this.artnetActionBuffer.stopBufferUpdate();
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        try
        {
            if (state && !state.ack)
            {
                // we have to get the deviceId out of the full path of the given state. I'll do this with some split, slice and join
                // there may be a better approach but i am not that familiar with iobroker if there is a proper method for that.
                const deviceId = this.getDeviceIdFromStateId(id);
                const deviceStateKey = this.getDeviceStateKeyFromStateId(id);
                const deviceStatePart = deviceStateKey.split('.')[0];
                const deviceStatePartKey = deviceStateKey.split('.').slice(1).join('.');
                const stateKey = id.split('.').pop();

                // update the internal object cache
                // the adapter stores the device settings and values in an internal object. We will get the data for the device out
                // of this object and we update this object with the new state, so we will have always 'up to date' data on this object
                this.updateInternalDeviceCacheFromState(id, state);

                // get the device settings and it's current state from the internal cache
                const deviceObject = this.deviceMap[deviceId];

                // if isOn, brightness or a channel value changes (stuff in the 'values' folder), we have to build an actions for the
                // action buffer. We utilize the 'valuesObject' methods for that
                if(this.artnetActionBuffer && deviceStatePart == 'values')
                {
                    const valuesObject = {};
                    SetObjectValue(valuesObject, deviceStatePartKey, state.val);
                    this.prepareValuesObjectForDevice(deviceObject, valuesObject);
                    this.applyValuesObjectForDevice(deviceObject, valuesObject);
                }

                // the adapter has the ability to set a 'state object' for a device
                // that means you can set the overall state of a device by one command which is presented by the control state
                if(this.artnetActionBuffer && deviceStatePart == 'control')
                {
                    // the control object can be used to set multiple states with one state
                    if(stateKey == 'valuesObject' && state.val)
                    {
                        const valuesObject = JSON.parse(state.val);
                        this.prepareValuesObjectForDevice(deviceObject, valuesObject);
                        this.applyValuesObjectForDevice(deviceObject, valuesObject);
                    }
                }

                // if we come here, the desired value for the state was not set by the adapter itself, so we have to ACK it
                // unfortunetally the ACK is only some kind of pseude ACK because we can not be sure the ARTNET module has
                // set the value (ArtNet is UDP)
                //this.extendObject(id, { val: state.val, ack: true });
                this.setStateAsync(id, { val: state.val, ack: true });
            }
            else
            {
                // The state was deleted.
                // We do nothing here for now. This shouldn't bother us anyway.
            }
        }
        catch(_exception)
        {
            this.log.error(_exception.message);
        }
    }

    /**
     * With this method the internal cache object will be updated with the value for the given state
     * It is used to keep the cache of the adapter up to date when a state changes
     * @param  {String} _stateId a state id (with full path)
     * @param  {Object} _state state object
     */
    updateInternalDeviceCacheFromState(_stateId, _state)
    {
        const deviceId = this.getDeviceIdFromStateId(_stateId);
        const deviceStateKey = this.getDeviceStateKeyFromStateId(_stateId);

        const deviceObject = this.deviceMap[deviceId];
        if(!deviceObject)
            throw new Error(`Device for id: ${deviceId} not found`);

        // if the key is not present in the object we do not process any further, the key has to be there
        if(GetObjectValue(deviceObject, deviceStateKey, undefined) === undefined)
            throw new Error(`Device key '${deviceStateKey}' not found on device ${deviceId}: ${JSON.stringify(deviceObject)}`);
        SetObjectValue(deviceObject, deviceStateKey, _state.val);
    }


    /**
     * This method will return the current brightness multiplicator for the given device.
     * It will check if the device is on or off. If the device is off it will always return 0
     * @param  {Object} _deviceObject a device object
     * @return  {Number}
     */
    getBrightnessMultiplicator(_deviceObject)
    {
        return (_deviceObject.values.brightness / 100) * (_deviceObject.values.isOn ? 1 : 0);
    }


    /**
     * This method will apply the values given in the values object to the device for the device object
     * It will create an artnet action buffer and send it to the artnet/dmx library
     * Be sure to call 'prepareValuesObjectForDevice' on the _valuesObject before calling this method
     * @param  {Object} _deviceObject a device object
     * @param  {Object} _valuesObject a values object
     */
    applyValuesObjectForDevice(_deviceObject, _valuesObject)
    {
        const deviceId = _deviceObject.id;
        const brightnessMultiplicator = this.getBrightnessMultiplicator(_deviceObject);

        // run through 'deviceObject.settings.channel' object prop's and if there is a non NULL value it means that the
        // channel is activce and we have to create an action buffer object for that channel to provide the new value to
        // the artnet backend
        for (const [objKey, objValue] of Object.entries(_deviceObject.settings.channel))
        {
            if(objValue)
            {
                const actionBuffer = {
                    'action'  : 'fadeto',
                    'channel' : objValue,
                    'value'   : _valuesObject.channel[objKey] * brightnessMultiplicator,
                    'fadeTime': this.getBufferActionFadeTime(_deviceObject)
                };
                this.artnetActionBuffer.addAction(actionBuffer);
            }
        }

        // update the internal cache values  so they are up to date, this is necessary when the whole values object
        // is beeing set via the 'valuesObject' state
        _deviceObject.values.isOn = _valuesObject.isOn;
        _deviceObject.values.brightness = _valuesObject.brightness;
        _deviceObject.values.temperature = _valuesObject.temperature;
        _deviceObject.values.channel.white = _valuesObject.channel.white;
        _deviceObject.values.channel.main = _valuesObject.channel.main;
        _deviceObject.values.channel.red = _valuesObject.channel.red;
        _deviceObject.values.channel.green = _valuesObject.channel.green;
        _deviceObject.values.channel.blue = _valuesObject.channel.blue;

        // set and ack the new states given by the valuesObject. due we have ACK set to true, the setState will not
        // trigger any action in the adapter (see 'onStateChanged' method). I am not sure if there is a better way
        // to update such 'bulk' data change. we will keep it for now
        this.setStateFromObjectAsync(_valuesObject, 'isOn', `${deviceId}.values.isOn`, DATATYPE.BOOLEAN, true);
        this.setStateFromObjectAsync(_valuesObject, 'brightness', `${deviceId}.values.brightness`, DATATYPE.NUMBER, true);
        this.setStateFromObjectAsync(_valuesObject, 'temperature', `${deviceId}.values.temperature`, DATATYPE.NUMBER, true);
        this.setStateFromObjectAsync(_valuesObject, 'channel.main', `${deviceId}.values.channel.main`, DATATYPE.NUMBER, true);
        this.setStateFromObjectAsync(_valuesObject, 'channel.red', `${deviceId}.values.channel.red`, DATATYPE.NUMBER, true);
        this.setStateFromObjectAsync(_valuesObject, 'channel.green', `${deviceId}.values.channel.green`, DATATYPE.NUMBER, true);
        this.setStateFromObjectAsync(_valuesObject, 'channel.blue', `${deviceId}.values.channel.blue`, DATATYPE.NUMBER, true);
        this.setStateFromObjectAsync(_valuesObject, 'channel.white', `${deviceId}.values.channel.white`, DATATYPE.NUMBER, true);
    }


    /**
     * This method should be used to prepare the 'valuesObject' for the 'applyValuesObjectForDevice' method
     * It will set/default all neede values on the values object if not there. Furthermore it will clear up values which are not used
     * by the device by it's type. (it will the those to 'undefined' so the value wont be set on a state which is not there)
     * @param {Object} _deviceObject
     * @param {Object} _valuesObject
     */
    prepareValuesObjectForDevice(_deviceObject, _valuesObject)
    {
        _valuesObject.channel = _valuesObject.channel !== undefined ? _valuesObject.channel : {};

        // if the valuesObject contains the temperature property we have to calculate the main and white channel
        // ist a very simple approach and the temperature is in the range of 0-100%. The temperature setting will override the main
        // and white channel values
        if(_valuesObject.temperature !== undefined && _valuesObject.temperature >= 0 && _valuesObject.temperature <= 100)
        {
            _valuesObject.channel.white = 255 * (_valuesObject.temperature/100);
            _valuesObject.channel.main = 255 - _valuesObject.channel.white;

            // if the type of the device is RGBW, then set RGB values as 'main' values
            if(_deviceObject.settings.type === DEVICETYPE.RGBW)
            {
                _valuesObject.channel.red = _valuesObject.channel.main;
                _valuesObject.channel.green = _valuesObject.channel.main;
                _valuesObject.channel.blue = _valuesObject.channel.main;
            }
        }

        // set values which are not given in the values object from the device object
        _valuesObject.isOn = _valuesObject.isOn !== undefined ? _valuesObject.isOn : _deviceObject.values.isOn;
        _valuesObject.brightness = _valuesObject.brightness !== undefined ? _valuesObject.brightness : _deviceObject.values.brightness;
        _valuesObject.temperature = _valuesObject.temperature !== undefined ? _valuesObject.temperature : _deviceObject.values.temperature;
        _valuesObject.fadeTime = _valuesObject.fadeTime !== undefined ? _valuesObject.fadeTime : this.getBufferActionFadeTime(_deviceObject);
        _valuesObject.channel.main = _valuesObject.channel.main !== undefined ? _valuesObject.channel.main : _deviceObject.values.channel.main;
        _valuesObject.channel.red = _valuesObject.channel.red !== undefined ? _valuesObject.channel.red : _deviceObject.values.channel.red;
        _valuesObject.channel.green = _valuesObject.channel.green !== undefined ? _valuesObject.channel.green : _deviceObject.values.channel.green;
        _valuesObject.channel.blue = _valuesObject.channel.blue !== undefined ? _valuesObject.channel.blue : _deviceObject.values.channel.blue;
        _valuesObject.channel.white = _valuesObject.channel.white !== undefined ? _valuesObject.channel.white : _deviceObject.values.channel.white;

        // default some values if they where not provided by the values object nor in the device object
        // this is in fact only here to 'repair' corrupt devices with 'undefined' values present
        _valuesObject.isOn = _valuesObject.isOn !== undefined ? _valuesObject.isOn : false;
        _valuesObject.brightness = _valuesObject.brightness !== undefined ? _valuesObject.brightness : 100;
        _valuesObject.temperature = _valuesObject.temperature !== undefined ? _valuesObject.temperature : -1;
        _valuesObject.channel.main = _valuesObject.channel.main !== undefined ? _valuesObject.channel.main : 0;
        _valuesObject.channel.red = _valuesObject.channel.red !== undefined ? _valuesObject.channel.red : 0;
        _valuesObject.channel.green = _valuesObject.channel.green !== undefined ? _valuesObject.channel.green : 0;
        _valuesObject.channel.blue = _valuesObject.channel.blue !== undefined ? _valuesObject.channel.blue : 0;
        _valuesObject.channel.white = _valuesObject.channel.white !== undefined ? _valuesObject.channel.white : 0;

        // set values to "undefined" if not available for the device
        const clearRGB = _deviceObject.settings.type == DEVICETYPE.DIMMABLE || _deviceObject.settings.type == DEVICETYPE.TW;
        const clearWhite = _deviceObject.settings.type == DEVICETYPE.DIMMABLE || _deviceObject.settings.type == DEVICETYPE.RGB;
        const clearMain = _deviceObject.settings.type == DEVICETYPE.RGB || _deviceObject.settings.type == DEVICETYPE.RGBW;
        const clearTemperature = _deviceObject.settings.type == DEVICETYPE.DIMMABLE || _deviceObject.settings.type == DEVICETYPE.RGB;
        _valuesObject.temperature = clearTemperature ? undefined : _valuesObject.temperature;
        _valuesObject.channel.main = clearMain ? undefined : _valuesObject.channel.main;
        _valuesObject.channel.red = clearRGB ? undefined : _valuesObject.channel.red;
        _valuesObject.channel.green = clearRGB  ? undefined : _valuesObject.channel.green;
        _valuesObject.channel.blue = clearRGB  ? undefined : _valuesObject.channel.blue;
        _valuesObject.channel.white = clearWhite ? undefined : _valuesObject.channel.white;
    }


    /**
     * a helper method to set an iobroker state from an object property
     * the state will only be set if the value of the property of the object is not 'unassigned'
     * @param  {Object} _object an object
     * @param  {String} _objectPath path to the property in the object
     * @param  {String} _statePath path of the state we want to set
     * @param  {String} _type type of the state we want to set
     * @param  {Boolean} _ack if the state value should be acknowledged
     */
    async setStateFromObjectAsync(_object, _objectPath, _statePath, _type, _ack = false)
    {
        const objectValue = GetObjectValue(_object, _objectPath, undefined);
        if(objectValue == undefined)
            return;
        await this.setStateAsync(_statePath, { val: this.convertValue(objectValue, _type), ack: _ack });
    }


    /**
     * will return the device id path form the given state id
     * @param  {String} _stateId a full state id
     * @return {String}
     */
    getDeviceIdFromStateId(_stateId)
    {
        return (_stateId.split('.').slice(0, 4)).join('.');
    }


    /**
     * will return the key path for the given state id (starting on device level)
     * @param  {String} _stateId the full state id
     * @return {String}
     */
    getDeviceStateKeyFromStateId(_stateId)
    {
        const deviceId = this.getDeviceIdFromStateId(_stateId);
        return _stateId.substring(deviceId.length + 1, _stateId.length);
    }


    /**
     * will return the fadeTime for changing values for the artnet device
     * @param  {Object} _deviceObject a device object
     * @return {Number}
     */
    getBufferActionFadeTime(_deviceObject)
    {
        if(!_deviceObject.settings.fadeTime)
        {
            _deviceObject.settings.fadeTime = -1;
            this.log.warn(`Fade time value on device ${_deviceObject.deviceId} not found, using standard value!`);
        }
        return _deviceObject.settings.fadeTime == -1 ? this.config.defaultFadeTime : _deviceObject.settings.fadeTime;
    }


    /**
     * this method will sync the devices adden in the admin gui to the object tree
     * it will add/remove devices and will update their settings
     */
    async updateArtnetDevices()
    {
        try
        {
            this.config.devices = this.config.devices ? this.config.devices : [];
            const deviceIds = new Array();
            for (const device of this.config.devices)
            {
                await this.addOrUpdateDevice(device);
                deviceIds.push(device.deviceId);
            }
            // we may have removed some devices in the admin view and those should be deleted from
            // the object store. Therefore we run through the current devices and check if they are
            await this.cleanupDevices(deviceIds);
        }
        catch(_exception)
        {
            this.log.error(_exception.message);
        }

        // be sure the internal device array is up to date, and will be reloaded from the object db store
        // we completely rebuild the array, that's okay here
        await this.buildDevicesArrayFromAdapterObjects();
    }


    /**
     * this method reads all devices (objects) from the object db store and some of its child objects/states
     * it's used as internal cache for all devices which are controled by this adapter
     */
    async buildDevicesArrayFromAdapterObjects()
    {
        try
        {
            this.devices = [];
            this.deviceMap = {};

            const deviceObjects = await this.getDevicesAsync();
            for (const deviceObject of deviceObjects)
            {
                const statePathDeviceSettings = deviceObject._id + '.settings';
                const settingsStates = await this.getStatesAsync(statePathDeviceSettings + '.*');

                const device = {};
                device.settings = {};
                device.settings.channel = {};
                device.values = {};
                device.values.channel = {};
                device.control = {};

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

                const statePathDeviceValues = deviceObject._id + '.values';
                const valuesStates = await this.getStatesAsync(statePathDeviceValues + '.*');

                device.values.isOn = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'isOn', null);
                device.values.brightness = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'brightness', null);
                device.values.temperature = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'temperature', null);
                device.values.channel.main = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.main', null);
                device.values.channel.red = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.red', null);
                device.values.channel.green = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues,'channel.green', null);
                device.values.channel.blue = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.blue', null);
                device.values.channel.white = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.white', null);

                const statePathDeviceControl= deviceObject._id + '.control';
                const controlStates = await this.getStatesAsync(statePathDeviceControl + '.*');

                device.control.valuesObject = this.getStateValueFromStatesObject(controlStates, statePathDeviceControl, 'valuesObject', null);

                this.devices.push(device);
                this.deviceMap[device.id] = device;
            }
        }
        catch(_error)
        {
            this.log.error(_error.message);
        }
    }


    /**
     * this method will return the value of the object for the given path
     * @param  {Object} _object the object
     * @param  {String} _path the path of the property
     * @param  {String} _key the key or another path with key
     * @param  {any} _defaultValue for the property if empty/null
     * @return {any} the value at the path and key
     */
    getStateValueFromStatesObject(_object, _path, _key, _defaultValue)
    {
        const fullKey = _path ? (_path + '.' + _key) : _key;
        if(_object[fullKey])
            return _object[fullKey].val;
        return _defaultValue;
    }


    /**
     * This method is usesd to remove unecessary devices which are not defined in given array of device id's
     * @param  {Array} _deviceIds Array of device id's which should be in the object store
     * @return {Promise}
     */
    async cleanupDevices(_deviceIds)
    {
        const deviceObjects = await this.getDevicesAsync();
        for (const deviceObject of deviceObjects)
        {
            const deviceId = (deviceObject._id).split('.').pop();
            if(_deviceIds.includes(deviceId) == false)
            {
                await this.delStateAsync(deviceObject._id);
                await this.delObjectAsync(deviceObject._id, {recursive: true});
            }
        }
    }


    /**
     * adds or updates a device id object and all its child's by the given device description object
     * @param  {Object} _deviceDescription the device description object
     * @return {Promise}
     */
    async addOrUpdateDevice(_deviceDescription)
    {
        const hasRGB = _deviceDescription.settings.type == DEVICETYPE.RGB || _deviceDescription.settings.type == DEVICETYPE.RGBW || _deviceDescription.settings.type == DEVICETYPE.RGBTW;
        const hasColorTemperature = _deviceDescription.settings.type == DEVICETYPE.RGBTW || _deviceDescription.settings.type == DEVICETYPE.TW || _deviceDescription.settings.type == DEVICETYPE.RGBW;
        const hasMain = _deviceDescription.settings.type == DEVICETYPE.DIMMABLE || _deviceDescription.settings.type == DEVICETYPE.RGBTW || _deviceDescription.settings.type == DEVICETYPE.TW;
        const hasWhite = hasColorTemperature || _deviceDescription.settings.type == DEVICETYPE.RGBW;

        // check if we are updateing a device or if its a new one. we need this information so we can set
        // default values on new devices when they are beeing created
        const existingObject = await this.getObjectAsync('lights.' + _deviceDescription.deviceId);
        const isCreation = existingObject ? false : true;

        // main device and channel objects
        await this.createObjectNotExists('lights.' + _deviceDescription.deviceId, _deviceDescription.name, 'device', null, true);
        await this.createObjectNotExists('lights.' + _deviceDescription.deviceId + '.settings', 'settings', 'channel');
        await this.createObjectNotExists('lights.' + _deviceDescription.deviceId + '.settings.channel', 'channel', 'channel');
        await this.createObjectNotExists('lights.' + _deviceDescription.deviceId + '.values', 'values', 'channel');
        await this.createObjectNotExists('lights.' + _deviceDescription.deviceId + '.values.channel', 'channel', 'channel');
        await this.createObjectNotExists('lights.' + _deviceDescription.deviceId + '.control', 'values', 'channel');

        // overall settings
        await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.fadeTime', 'fadeTime', DATATYPE.NUMBER, '', _deviceDescription.settings.fadeTime);
        await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.type', 'type', DATATYPE.STRING, '', _deviceDescription.settings.type);

        // set some value objects/states for the devices but do not overwrite any values which are already present
        await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.isOn', 'isOn', DATATYPE.BOOLEAN, 'switch.light', false, false, isCreation);
        await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.brightness', 'brightness', DATATYPE.NUMBER, 'level.dimmer', 100, false, isCreation);

        if(hasMain)
        {
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.channel.main', 'main', DATATYPE.NUMBER, '',_deviceDescription.settings.channel.main, true); 
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.channel.main', 'main', DATATYPE.NUMBER, 'level.color.white', 0, false, isCreation);
        }

        if(hasRGB)
        {
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.channel.red', 'red', DATATYPE.NUMBER, '',_deviceDescription.settings.channel.red, true);
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.channel.green', 'green', DATATYPE.NUMBER, '', _deviceDescription.settings.channel.green, true);
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.channel.blue', 'blue', DATATYPE.NUMBER, '',_deviceDescription.settings.channel.blue, true);
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.channel.red', 'red', DATATYPE.NUMBER, 'level.color.red', 0, false, isCreation);
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.channel.green', 'green', DATATYPE.NUMBER, 'level.color.green', 0, false, isCreation);
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.channel.blue', 'blue', DATATYPE.NUMBER, 'level.color.blue', 0, false, isCreation);
        }

        if(hasWhite)
        {
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.settings.channel.white', 'white', DATATYPE.NUMBER, '',_deviceDescription.settings.channel.white, true);
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.channel.white', 'white', DATATYPE.NUMBER, 'level.color.white', 0, false, isCreation);
        }

        if(hasColorTemperature)
        {
            await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.values.temperature', 'temperature', DATATYPE.NUMBER, 'level.color.temperature', 50, false, isCreation);
        }

        // controlTW
        await this.createOrUpdateState('lights.' + _deviceDescription.deviceId + '.control.valuesObject', 'valuesObject', DATATYPE.JSON, 'json', null, false, isCreation);
    }

    /**
     * a special helper method to easily add objects
     * @param  {String} _id the object id
     * @param  {String} _name the object name
     * @param  {String} _type the object type (e.g. device, channel, state, ...)
     * @param  {Object} _common the common description of the object which will be created
     * @return {Promise}
     */
    async createObjectNotExists(_id, _name, _type, _common = null, _forceOverwrite = false)
    {
        const commonObject = _common ? _common : {};
        commonObject.name = _name;

        const objectContainer = {
            type: _type,
            common: commonObject,
            native: {},
        };

        if(_forceOverwrite) {
            await this.setObjectAsync(_id, objectContainer);
        }
        else {
            await this.setObjectNotExistsAsync(_id, objectContainer);
        }
    }


    /**
     * a special helper method to easily add/remove and change values of states
     * @param  {String} _id the state id
     * @param  {String} _name the state name
     * @param  {String} _stateType the state type (e.g. number, string, ...) If this value is set, the object will be a state
     * @param  {any} _stateValue the value of the state
     * @param  {Boolean} _deleteStateOnNullValue indicates if passing a null value should delete the state and its object
     * @param  {Boolean} _allowSetValue indicates if the value given value will be set (mainly used for syncing the state object with admin)
     * @return {Promise}
     */
    async createOrUpdateState(_id, _name, _stateType, _stateRole, _stateValue, _deleteStateOnNullValue = true, _allowSetValue = true)
    {
        const commonObject = {
            type: _stateType,
            role: _stateRole ? _stateRole : 'state',
            read: true,
            write: true
        };
        await this.createObjectNotExists(_id, _name, 'state', commonObject);

        if(_allowSetValue)
        {
            if(_deleteStateOnNullValue && _stateValue === null)
            {
                await this.delStateAsync(_id);
                await this.delObjectAsync(_id);
            }
            else
            {
                await this.setStateAsync(_id, { val: this.convertValue(_stateValue, _stateType), ack: true });
            }
        }
    }


    /**
     * conversion method for any value to the type given in the parameters
     * currently only 'string' and 'number' is a valid type
     * @param  {any} _value the value ehich should be converted
     * @param  {String} _type the type the value should be converted to
     * @return {any} _value converted to the given _type
     */
    convertValue(_value, _type)
    {
        let converted;

        if(_value === null)
            return _value;

        switch(_type)
        {
            case DATATYPE.STRING:
                converted = _value.toString();
                break;
            case DATATYPE.NUMBER:
                converted = Number(_value);
                break;
            default:
                converted = _value;
        }
        return converted;
    }

}


if (require.main !== module) {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Artnetdmx(options);
} else {
    new Artnetdmx();
}
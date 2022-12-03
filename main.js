/*
    TODO:
    * Configuration initial values
    * save empty as NULL (so objects are deleted)
*/

'use strict';

const utils = require('@iobroker/adapter-core');
const path = require('node:path');
const ArtnetActionBuffer = require(path.resolve( __dirname, './lib/artnetActionBuffer/artnetActionBuffer'));


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
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {

        // TODO: Artnet informations from configuration
        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);

        // build device settings object for the admin page (the device list will be created from the devices in the object list)
        // the admin page will show the devices defined in the object list and the values of the settings given in the "settings"
        // channel of the device
        await this.buildDevicesArrayFromAdapterObjects();

        // setup the artnet action buffer which will do the connection and action handling for us
        this.artnetActionBuffer = new ArtnetActionBuffer();
        this.artnetActionBuffer.on('connectionState', (_connected) => {
            this.setState('info.connection', _connected, true);
        });
        this.artnetActionBuffer.on('error', (_exception) => {
            this.log.error(_exception.message);
            //this.log.error(_exception.ToString());
        });
        this.artnetActionBuffer.startBufferUpdate();

        // subscribe to all 'settings' states in the adapter
        this.subscribeStates('*');
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
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // TODO
            // The object was changed
            // TODO: create action buffer from given object
            //this.artnetActionBuffer.addAction(_actionBuffer)
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // TODO
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
        try
        {
            if (state)
            {
                // if isOn, brightness or a channel value changes, we have to build an action for the action buffer
                // when the action is finished we have to ack the values?!?! --> Buffer will have an ack event?!
                // 	state artnetdmx.0.lights.TEST.values.channel.blue changed: 10 (ack = false)
                // artnetdmx.0.lights.TEST.values.channel.blue
                // artnetdmx.0.lights.Kueche_Spots.values.isOn
                if(this.artnetActionBuffer)
                {
                    const key = id.split('.').pop();
                    let actionBuffer = null;
                    const stateStr = JSON.stringify(state);

                    this.log.info(`Id: ${id}`);
                    this.log.info(`Key: ${key}`);
                    this.log.info(`State: ${stateStr}`);
              

                    // artnetdmx.0.lights.Küche-TEST.*****
                    const deviceId = (id.split('.').slice(0, 4)).join('.');
                    this.log.info(`DeviceId: ${deviceId}`);

                    const deviceObject = this.deviceMap[deviceId];
                    const deviceStr = JSON.stringify(deviceObject);
                    this.log.info(`Device: ${deviceStr}`);

                    // TODO: get the id of the device and then get all states for the device
                    // deviceStates = getCachedDeviceStates();

                    // update new value on cached object
                    // deviceStates.values[key] = state.val;

                    // TODO: @@@ add functions an cache the values (remove cache if any state on the 'settings level' was changed!)
                    // TODO: IsOn and Brightness will should change the cached device object
                    //const deviceObject = {};
                    const brightnessMultiplicator = (deviceObject.values.brightness / 100) * (deviceObject.values.IsOn ? 1 : 0);

                    if(key == 'isOn')
                    {
                        // get current rgb value object from type of device

                        // TODO @@@ run through the device channels object and add the action buffers
                        actionBuffer = {
                            'action'  : 'fadeto',
                            'channel' : deviceObject.settings.channel.red,
                            'value'   : deviceObject.values.channel.red * brightnessMultiplicator
                        };
                    }
                    // todo: brightness key
                    else
                    {
                        // if channel VALUE add action buffer for that
                        actionBuffer = {
                            'action'  : 'fadeto',
                            'channel' : deviceObject.settings.channel[key], // get channel from key
                            'value'   : state.val * brightnessMultiplicator
                        };
                    }

                    // setState("Test_Object", {val: {"eins":0,"zwei":1}}); 

                    //const channel   = _data.channel-1;
                    //_data.action    = _data.action ? _data.action.toUpperCase() : 'SET';

                    if(actionBuffer)
                    {
                        this.artnetActionBuffer.addAction(_actionBuffer);
                    }
                }
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            }
            else
            {
                // The state was deleted
                this.log.info(`state ${id} deleted`);
            }
        }
        catch(_exception)
        {
            this.log.error(_exception.message);
        }
    }

    /**
     * Is called when a message is sent to the backend
     * @param {Object} _obj message that was sent
     */
    onMessage(_obj)
    {
        this.handleMessages(_obj);
        return true;
    }

    /**
     * Is called when a message is sent to the backend
     * @param {Object} _obj message that was sent
     */
    async handleMessages(_obj)
    {
        //this.log.warn(JSON.stringify(_obj));

        if (typeof _obj === 'object')
        {
            switch (_obj.command)
            {
                // the admin gui does need to convert user given object id's to valid object db store id's
                // that means the have to remove special chars from the string so we can use it as an id
                case 'formatObjectId':
                    if (_obj.callback) {
                        const validObjectId = this.formatObjectId(_obj.message.toString());
                        this.sendTo(_obj.from, _obj.command, validObjectId, _obj.callback);
                    }
                    break;

                // the admin gui refelects the devices in the object store and you can define some settings there
                // for that to work it does need all the devices and their channels and state which can be received
                // eith this type of message
                case 'requestArtnetDevices':
                    if (_obj.callback) {
                        this.sendTo(_obj.from, _obj.command, this.devices, _obj.callback);
                    }
                    break;

                // in the state of saving the configuration (when the admin gui saves it's configuration) it will
                // send us the array of artnet devices configured in the admin
                case 'updateArtnetDevices':
                    try
                    {
                        const deviceIds = new Array();
                        for (const device of _obj.message)
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
                    // we completely rebuild the array, thats okay here
                    await this.buildDevicesArrayFromAdapterObjects();

                    // the callback here is some kind of mandatory, because otherwise the admin gui 'save' function
                    // will not work correctly (it awaits the callback to not retsart the backend before save was
                    // finished!)
                    if (_obj.callback) {
                        this.sendTo(_obj.from, _obj.command, {}, _obj.callback);
                    }
                    break;
            }
        }
    }

    /**
     * this method reads all devices (objects) from the object db store and some of its child objects/states
     * this data will be stored (cached) in an array for passing it to the admin gui later on
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
                device.values.channel.main = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.main', null);
                device.values.channel.red = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.red', null);
                device.values.channel.green = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues,'channel.green', null);
                device.values.channel.blue = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.blue', null);
                device.values.channel.white = this.getStateValueFromStatesObject(valuesStates, statePathDeviceValues, 'channel.white', null);

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
     * TODO: @@@
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
     * use this method to format a n 'on clean' objectId to a 'clean' (valid) objectId
     * @param  {String} _objectId the non clean object id
     * @return {String} _objectId as clean usable value in the object db store
     */
    formatObjectId(_objectId)
    {
        let validObjectId = _objectId.replace(this.FORBIDDEN_CHARS, '_');
        validObjectId = validObjectId.replace(/[\.\s\/]/g, '_');
        return validObjectId;
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
     * @param  {Object} _device the device description object
     * @return {Promise}
     */
    async addOrUpdateDevice(_device)
    {
        // TODO: verify before adding the device?!
 
        // main device and channel objects
        await this.createObjectNotExists('lights.' + _device.deviceId, _device.name, 'device', null, true);
        await this.createObjectNotExists('lights.' + _device.deviceId + '.settings', 'settings', 'channel');
        await this.createObjectNotExists('lights.' + _device.deviceId + '.settings.channel', 'channel', 'channel');
        await this.createObjectNotExists('lights.' + _device.deviceId + '.values', 'values', 'channel');
        await this.createObjectNotExists('lights.' + _device.deviceId + '.values.channel', 'channel', 'channel');

        // overall settings
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.fadeTime', 'fadeTime', 'number', _device.settings.fadeTime);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.type', 'type', 'string', _device.settings.type);

        // channels
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.channel.main', 'main', 'number', _device.settings.channel.main, true);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.channel.red', 'red', 'number', _device.settings.channel.red, true);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.channel.green', 'green', 'number', _device.settings.channel.green, true);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.channel.blue', 'blue', 'number', _device.settings.channel.blue, true);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.settings.channel.white', 'white', 'number', _device.settings.channel.white, true);

        // set some value objects/states for the devices but do not overwrite any values which are already present
        // those are the states that are always present on every device, even if the device is not capable of that state!
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.isOn', 'isOn', 'boolean', null, false, false);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.brightness', 'brightness', 'number', null, false, false);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.channel.main', 'main', 'number', null, false, false);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.channel.red', 'red', 'number', null, false, false);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.channel.green', 'green', 'number', null, false, false);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.channel.blue', 'blue', 'number', null, false, false);
        await this.createOrUpdateState('lights.' + _device.deviceId + '.values.channel.white', 'white', 'number', null, false, false);
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
            await this.setObjectAsync(_id, objectContainer)
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
    async createOrUpdateState(_id, _name, _stateType, _stateValue, _deleteStateOnNullValue = true, _allowSetValue = true)
    {
        const commonObject = {
            type: _stateType,
            role: 'state',
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
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Artnetdmx(options);
} else {
    new Artnetdmx();
}
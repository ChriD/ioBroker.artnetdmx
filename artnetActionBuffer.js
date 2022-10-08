/*
*/

'use strict';

const DMXLib = require('./lib/dmxnet');

class ArtnetActionBuffer
{
    constructor(_configuration)
    {
        this.configuration          = _configuration;
        this.artnet                 = null;
        this.artnetSender           = null;

        // this buffer contains the current value which will be sent to the artnet protocol
        this.buffer                 = [512];
        this.bufferUpdateInterval   = 0;

        // clear the buffer
        for(let idx=0; idx<=512; idx++)
            this.buffer[idx] = 0;

        // this one contains all actions which are pending (set/fade/..) and which have to be
        // processed by the main loop. E.g.:
        // { channel: 1, value : 133,  action : 'fade', step: 0.34 }
        // { channel: 2, value : 75,   action : 'set' }
        this.bufferAction = [];

        this.bufferUpdateIntervalId = setInterval(() => {
            this.updateArtnetBuffer();
        }, this.bufferUpdateInterval);
    }


    // the buffer has to be updated on intervall, if there is something to do, the changes
    // will be sent to the artnet library. This method has to be called at least one time after
    // instanciating the action buffer
    startBufferUpdate()
    {
        this.disconnectFromArtNet();
        this.connectToArtNet();

        // calculate the approximate ms interval for the given fps
        this.bufferUpdateInterval = 1000/this.configuration.framesPerSec;

        // clear out existing timers in case of restarting the buffer update
        this.stopBufferUpdate();

        this.bufferUpdateIntervalId = setInterval(() => {
            this.updateArtnetBuffer();
        }, this.bufferUpdateInterval);
    }

    stopBufferUpdate()
    {
        if(this.bufferUpdateIntervalId)
            clearInterval(this.bufferUpdateIntervalId);
    }


    connectToArtNet()
    {
        this.artnet = new DMXLib.dmxnet({});
        this.artnetSender = this.artnet.newSender({
            ip: this.configuration.host,
            subnet: 0,
            universe: this.configuration.universe,
            net: 0,
            port: this.configuration.port,
            base_refresh_interval : this.configuration.refresh
        });
    }

    disconnectFromArtNet()
    {
        if(this.artnetSender)
        {
            this.artnetSender.stop();
            this.artnetSender = null;
        }
    }

    updateArtnetBuffer()
    {
        if(!this.artnetSender)
            return;

        const keys = Object.keys(this.bufferAction);
        for(let idx=0; idx<keys.length; idx++)
        {
            try
            {
                const actionObj = this.bufferAction[keys[idx]];
                let deleteBufferAction = false;
                switch(actionObj.action.toUpperCase())
                {
                    case 'FADETO':
                        this.buffer[actionObj.channel-1] += actionObj.step;
                        if( (actionObj.step > 0 && this.buffer[actionObj.channel-1] >= actionObj.value) ||
                            (actionObj.step < 0 && this.buffer[actionObj.channel-1] <= actionObj.value) ||
                            (actionObj.step === 0 || this.buffer[actionObj.channel-1] == actionObj.value))
                        {
                            this.buffer[actionObj.channel-1] = actionObj.value;
                            deleteBufferAction = true;
                        }
                        break;
                    case 'SET':
                        this.buffer[actionObj.channel-1] = actionObj.value;
                        deleteBufferAction = true;
                        break;
                    default:
                }

                // prepare the value on the channel for sending. Sending will be done via the 'transmit' method
                this.artnetSender.prepChannel(actionObj.channel-1, this.buffer[actionObj.channel-1]);

                // remove the action buffer entry for the channel if the work is done (e.g. when we have reached the desired value)
                if(deleteBufferAction)
                    delete this.bufferAction[keys[idx]];
            }
            catch(_exception)
            {
                // TODO:@@@
            }
        }

        // TODO: catch exception. if there is one, emit error / and connectionState?
        this.artnetSender.transmit();
    }


    addAction(_data)
    {
        // the channel on this library starts with '0' (artnet usally start's with 1)
        const channel   = _data.channel-1;
        _data.action    = _data.action ? _data.action.toUpperCase() : 'SET';

        if(!channel || channel < 0)
        {
            return;
        }

        // we do need to have a value in the data object. At least if we are haveing the action 'set' or 'fadeto'
        // if we are implementing more actions we have to adapt this code
        if(isNaN(_data.value))
        {
            return;
        }

        switch(_data.action)
        {
            case 'SET':
                // we can use a 1:1 link of the given data object. No need to copy.
                this.bufferAction[channel] = _data;
                this.bufferAction[channel].fadeTime = 0;
                this.bufferAction[channel].step = (this.bufferAction[channel].value - this.buffer[channel]);
                break;
            case 'FADETO':
                // we can use a 1:1 link of the given data object. No need to copy.
                // but we have to update/add and calc the step value each updateIntervall
                this.bufferAction[channel] = _data;
                this.bufferAction[channel].fadeTime = this.bufferAction[channel].fadeTime ? this.bufferAction[channel].fadeTime : 250;
                this.bufferAction[channel].step = ((this.bufferAction[channel].value - this.buffer[channel]) / this.bufferAction[channel].fadeTime) * this.bufferUpdateInterval;
                break;
            default:
        }
    }

}


module.exports = ArtnetActionBuffer;
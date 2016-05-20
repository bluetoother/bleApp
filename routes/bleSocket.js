var io = require('socket.io'),
    _ = require('lodash'),
    Q = require('q');

var manager = require('../../ble-shepherd')('cc254x'),
    devmgr = require('../models/devmgr.js'),
    XivelyClient = require('../models/xively.js'),
    client = new XivelyClient();

var spCfg = {
        path: '/dev/ttyACM0',
        options: {
            baudRate: 115200,
            rtscts: true,
            flowControl: true
        }
    },
    bleSocket,
    connFlag = false,
    sensorFlag = false,
    plugFlag = false,
    relayFlag = false,
    pauseDevs = [],
    sensorTag,
    keyFob,
    plug,
    relay,
    pir,
    healBracelet;

client.setKey('ZE1QH7o7Zad9pGR5h6e95CPqpncGenX1qttOa5WuHSE5eF9D');

exports.initialize = function(server) {
    io = io(server);

    io.on('connection', function (socket) {
        bleSocket = socket;
        if (!connFlag) {
            manager.start(bleApp, spCfg);
            connFlag = true;
        }
        socket.emit('hello', {x: 123});
        socket.on('req', socketReqHdlr);
        socket.on('getTemp', function () {
            socket.emit('sendTemp', tempValArr);
        });
    });
};

manager.appInit = appInit;

function appInit () {
     manager.regGattDefs('characteristic', [
        {name: 'KeyPressState', uuid: '0xffe1', params: ['enable'], types: ['uint8']}, 
        {name: 'Temp', uuid: '0xaa01', params: ['rawT2', 'rawT1'], types: ['uint16', 'uint16']}, 
        {name: 'Accelerometer', uuid: '0xaa11', params: ['x', 'y', 'z'], types: ['uint8', 'uint8', 'uint8']},
        {name: 'Humid', uuid: '0xaa21', params: ['rawT', 'rawH'], types: ['uint16', 'uint16']},
        {name: 'Gyroscope', uuid: '0xaa51', params: ['x', 'y', 'z'], types: ['uint16', 'uint16', 'uint16']}]);
}

function bleApp () {
    manager.on('IND', manaIndHdlr);
}

function manaIndHdlr (msg) {
    var dev;

    switch (msg.type) {
        case 'DEV_INCOMING':
            dev = manager.find(msg.data);
            if (dev) { processDevIncome(dev); }
            break;
        case 'DEV_ONLINE':
            dev = manager.find(msg.data.addr);
            dev.connHdl = msg.data.connHandle;
            if (dev) { processDevOnline(dev); }
            break;
        case 'DEV_PAUSE':
            dev = manager.find(msg.data);
            if (dev) { processDevPause(dev); }
            break;
        case 'DEV_LEAVING':
            dev = devmgr.find(msg.data);
            if (dev) {
                dev.state = 'offline';
                io.sockets.emit('rsp', {type: 'devLeaving', data: msg.data});
            }
            break;
        case 'PASSKEY_NEED':
            break;
    }
}

function socketReqHdlr (msg) {
    var data = msg.data,
        dev,
        clkArr,
        chunk1,
        chunk2;

    switch (msg.type) {
        case 'setNotify':
            var startMeasArr = ['0xaa00', '0xaa10', '0xaa20', '0xaa30', '0xaa40', '0xaa50'],
                val = new Buffer([0x01]);

            dev = manager.find(data.devId);
            if (data.devId === '0x00188c37b65c') {
                dev.write('0x1814', '0x2aff', new Buffer([0x00, 0x00, 0x00, 0x13]));
            } else {
                console.log(dev);
                dev.setNotify(data.uuidServ, data.uuidChar, data.config).then(function () {
                    if (_.includes(startMeasArr, data.uuidServ)) {
                        if (data.config) { val = new Buffer([0x01]); }
                        dev.write(data.uuidServ, '0x' + (parseInt(data.uuidChar) + 1).toString(16), val);
                    }
                dev.notif = 'on';
                }).fail(function (err) {
                    console.log(err);
                }).done();
            }
            break;

        case 'write':
            dev = manager.find(data.devId);
            if (data.devId === '0xd03972c3d10a') {
                if (data.val === 'on') {
                    //41:54:43:50:00:01:29:00:00:00:00:00:1F:87:12:8D:01:00:00:00
                    connAndSwitchPlug('on');
                } else {
                    //41:54:43:50:00:00:28:00:00:00:00:00:1f:87:12:8d:01:00:00:00
                    connAndSwitchPlug('off');
                }
                devmgr.findGad(data.devId, 'ctrls', data.uuidServ).val = data.val;
            } else if (data.devId === '0x5c313e2bfb7b') {
                if (data.val === 'on') {
                    connAndSwitchRelay('on');
                } else {
                    connAndSwitchRelay('off');
                }
                devmgr.findGad(data.devId, 'ctrls', data.uuidServ).val = data.val;
            } else if (data.devId === '0x00188c37b65c') {
                chunk1 = data.val & 0xff;
                chunk2 = (data.val & 0xff00 )>> 8;

                devmgr.findGad(data.devId, 'ctrls', data.uuidServ);
                if (data.uuidServ === '0x1814-3') {
                    clkArr = [0x00, 0x00, 0x00, 0x71, chunk1, chunk2, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
                } else if (data.uuidServ === '0x1814-4') {
                    clkArr = [0x00, 0x00, 0x00, 0x70, 0x74, 0x01, 0x30, 0x11, 0x5e, 0x06, 0x43, 0x00, 0x17, 0x00, chunk1, chunk2, 0x00, 0x00, 0x1b, 0x00];
                }
                healBracelet.write('0x1814', '0x2aff', new Buffer(clkArr));
                devmgr.findGad(data.devId, 'ctrls', data.uuidServ).val = data.time;
            }
            break;

        case 'rmvDev':
            dev = manager.find(data);
            devmgr.remove(data);
            dev.remove();
            break;
    }
}

/*************************************************************************************************/
/*** manager Event Handler                                                                     ***/
/*************************************************************************************************/
function processDevIncome (dev) {
    var emitFlag = true,
        newDev;

    dev.updateLinkParam(160, 0, 1000);

    switch (dev.addr) {
        case '0x00188c37b65c':
            healBracelet = dev;
            healBracelet.write('0x1814', '0x2aff', new Buffer([0x00, 0x80, 0x00, 0x13]));
            healBracelet.regCharHdlr('0x1814', '0x2a53', callbackHeal);
            break;
        case '0x9059af0b8159':
            sensorTag = dev;
            sensorTag.regCharHdlr('0xaa00', '0xaa01', tempNotifHdlr);
            sensorTag.regCharHdlr('0xaa10', '0xaa11', acceNotifHdlr);
            sensorTag.regCharHdlr('0xaa20', '0xaa21', humidNotifHdlr);
            sensorTag.regCharHdlr('0xffe0', '0xffe1', simpleKeyNotifHdlr);
            sensorTagNotif();
            break;
        case '0x544a165e1f53':
            keyFob = dev;
            keyFob.regCharHdlr('0xffe0', '0xffe1', simpleKeyNotifHdlr);
            break;
        case '0xd05fb820a857':
            pir = dev;
            pir.regCharHdlr('0xaac0', '0xaac1', callbackPir);
            break;
        case '0xd03972c3d10a':
            plug = dev;
            plug.switch = 'off';
            plug.ctrlSwitch = 'off';
            plug.disconnect().then(function () {
                console.log('Disconnect to plug');
                plug.state = 'pause';
            });
            break;
        case '0x5c313e2bfb7b':
            relay = dev;
            relay.switch = 'off';
            relay.disconnect().then(function () {
                console.log('Disconnect to relay');
                relay.state = 'pause';
            });
            break;
        default:
            dev.remove();
            emitFlag = false;
            break;
    }

    if(emitFlag) {
        newDev = devmgr.newDev(dev);
        newDev.state = 'online';
        newDev.name = dev.findChar('0x1800', '0x2a00').val.name;
        io.sockets.emit('rsp', {type: 'devIncoming', data: {addr: dev.addr, name: newDev.name}});

        newDev.notif = 'on';
    }
}

function processDevOnline (dev) {
    if (dev.addr === '0xd03972c3d10a') {
        plug = dev;
        plug.updateLinkParam(40, 0, 1000);
        plug.regCharHdlr('0xf110', '0xf114', callbackPlugSwitch);
    } else if (dev.addr === '0x5c313e2bfb7b') {
        relay = dev;
        relay.updateLinkParam(160, 0, 1000);
        relay.regCharHdlr('0xaab0', '0xaab1', callbackRelaySwitch);
        relay.regCharHdlr('0xaaa0', '0xaaa1', callbackRelayPowerVal);
    }
}

function processDevPause (dev) {
    var emitFlag = true,
        newDev;

    if (dev.addr === '0xd03972c3d10a') {
        plug = dev;
        plug.switch = 'off';
        plug.ctrlSwitch = 'off';
    } else if (dev.addr === '0x5c313e2bfb7b') {
        relay = dev;
        relay.switch = 'off';
    } else {
        emitFlag = false;
        connectPauseDev(dev);
    }

    if (emitFlag) {
        newDev = devmgr.newDev(dev);
        newDev.name = dev.findChar('0x1800', '0x2a00').val.name;
        io.sockets.emit('rsp', {type: 'devIncoming', data: {addr: dev.addr, name: newDev.name}});
    }
}

/*************************************************************************************************/
/*** attribute ind/notif function                                                              ***/
/*************************************************************************************************/
var tempCount = 0,
    tempValArr = [];

function tempNotifHdlr (data) {
    var rawT1, rawT2, m_tmpAmb, Vobj2, Tdie2,  
        Tref = 298.15, 
        S, Vos, fObj, tObj,
        emitObj = {
            devAddr: sensorTag.addr,
            sensorType: '0xaa00',
            value: null
        },
        date = new Date();

    rawT1 = data.rawT1;
    rawT2 = data.rawT2;
    
    if(rawT2 > 32768) {
        rawT2 = rawT2 - 65536;
    }

    m_tmpAmb = (rawT1)/128.0;
    Vobj2 = rawT2 * 0.00000015625;
    Tdie2 = m_tmpAmb + 273.15;
    S = (6.4E-14) * (1 + (1.75E-3) * (Tdie2 - Tref) + (-1.678E-5) * Math.pow((Tdie2 - Tref), 2));
    Vos = -2.94E-5 + (-5.7E-7) * (Tdie2 - Tref) + (4.63E-9) * Math.pow((Tdie2 - Tref), 2);
    fObj = (Vobj2 - Vos) + 13.4 * Math.pow((Vobj2 - Vos), 2);
    tObj = Math.pow(Math.pow(Tdie2, 4) + (fObj/S), 0.25);
    tObj = _.ceil((tObj - 273.15), 2);

    console.log('Temperature:   ' +  tObj);
    console.log('-');
    emitObj.value = tObj;
    devmgr.findGad(sensorTag.addr, 'sensors', '0xaa00').val = tObj;
    if (tObj > 30 && plug && relay.switch === 'off') {
        connAndSwitchRelay('on');
    }

    if (tempCount === 0) {
        tempValArr.push({
            date: date.getFullYear() + '-' + date.getMonth() + 1 + '-' + date.getDate() + ' ' +
                   date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
            value: tObj
        });
        io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
        client.feed.new('99703785', 'temperature', tObj);
    }

    tempCount += 1;
    if (tempCount === 3) { tempCount = 0; }
}

var accelerCount = 0;
function acceNotifHdlr (data) {
    var x = data.x,
        y = data.y,
        z = data.z,
        dev = devmgr.findGad(sensorTag.addr, 'sensors', '0xaa10'),
        emitObj = {
            devAddr: sensorTag.addr,
            sensorType: '0xaa10',
            value: null
        };

    if (x > 127) { x = x - 255; }
    x = _.ceil(x / 16, 1);

    if (y > 127) { y = y - 255; }
    y = _.ceil(y / 16, 1);

    if (z > 127) { z = z - 255; }
    z = _.ceil(z / 16, 1);

    emitObj.value = { x: x, y: y, z: z };
    dev.val = 'X-' + x + ' Y-' + y + ' Z-' + z;
    console.log('Accelerometer: ' + dev.val);
    console.log('-');

    if (accelerCount === 0) {
        io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
    }

    accelerCount += 1;
    if (accelerCount === 3) { accelerCount = 0; }
}

var humidCount = 0;
function humidNotifHdlr (data) {
    var temp,
        humid,
        emitObj = {
            devAddr: sensorTag.addr,
            sensorType: '0xaa20',
            value: null
        };

    temp = _.ceil((data.rawT * (175.72 / 65536)) - 48.65, 2);
    humid = _.ceil((data.rawH * (125 / 65536)) - 6, 2);
    emitObj.value = humid;
    devmgr.findGad(sensorTag.addr, 'sensors', '0xaa20').val = humid;
    console.log('Humidity:      ' + humid);
    console.log('-');

    if (humidCount === 0) {
        io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
    }

    humidCount += 1;
    if (humidCount === 3) { humidCount = 0; }
    
}

function simpleKeyNotifHdlr (data) {
    value = data.enable;

    if (value === 1) {
        if (plug.ctrlSwitch === 'off') {
            if (plug.switch === 'on') {
                plug.ctrlSwitch = 'on';
            } else {
                connAndSwitchPlug('on', function (err) {
                    if (!err) { plug.ctrlSwitch = 'on'; }
                });
            }
        } else {
            connAndSwitchPlug('off', function (err) {
                if (!err) { plug.ctrlSwitch = 'off'; }
            });
        }
    } else if (value === 2) {
        if (relay.switch === 'off') {
            connAndSwitchRelay('on');
        } else {
            connAndSwitchRelay('off');
        }
        
    }
}

var healCount = 0;
function callbackHeal (data) {
    var emitObj1 = {
            devAddr: healBracelet.addr,
            sensorType: '0x1814-1',
            value: data.readUInt16LE(8)
        },
        emitObj2 = {
            devAddr: healBracelet.addr,
            sensorType: '0x1814-2',
            value: data.readUInt16LE(14)
        };

    devmgr.findGad(healBracelet.addr, 'sensors', '0x1814-1').val = emitObj1.value;
    devmgr.findGad(healBracelet.addr, 'sensors', '0x1814-2').val = emitObj2.value;

    if (healCount === 0) {
        io.sockets.emit('rsp', {type: 'attrInd', data: emitObj1});
        io.sockets.emit('rsp', {type: 'attrInd', data: emitObj2});
    }

    healCount += 1;
    if (healCount === 3) { healCount = 0; }
    
}

function callbackPlugSwitch (data) {
    var onoff = data.readUInt8(3),
        emitObj = {
            devAddr: plug.addr,
            sensorType: '0xf110',
            value: null
        };

    if (plug) {
        if (onoff === 0x90) {
            plug.switch = 'on';
            emitObj.value = 'on';
        } else if (onoff === 0x10) {
            plug.switch = 'off';
            emitObj.value = 'off';
        }
    }
    io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
}

function callbackRelaySwitch (data) {
    var onoff = data.readUInt8(),
        emitObj = {
            devAddr: relay.addr,
            sensorType: '0xaab0',
            value: null
        };

    if (relay) {
        if (onoff === 1) {
            relay.switch = 'on';
            emitObj.value = 'on';
        } else if (onoff === 0) {
            relay.switch = 'off';
            emitObj.value = 'off';
        }
    }
    io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
}

function callbackRelayPowerVal (data) {
    var power = data.readUInt16LE();

    if (relay) { relay.power = power; }
}

function callbackPir (data) {
    var val = data.readUInt8(),
        emitObj = {
            devAddr: pir.addr,
            sensorType: '0xaac0',
            value: null
        };

    if (val === 1) { emitObj.value = 'on'; }
    if (val === 0) { emitObj.value = 'off'; }
    devmgr.findGad(pir.addr, 'sensors', '0xaac0').val = emitObj.value;
    io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});

    if (val === 1 && plug.switch === 'off' && plug.ctrlSwitch === 'off') {
        connAndSwitchPlug('on');
    } else if (val === 0 && plug.switch === 'on' && plug.ctrlSwitch === 'off') {
        connAndSwitchPlug('off');
    }
}

/*****************************************************
 *    sensorTag   API                                *
 *****************************************************/
function sensorTagTemp (value, callback) {
    var config, buf;

    if (value === 0) {
        config = false;
        buf = new Buffer([0x00]);
    } else {
        config = true;
        buf = new Buffer([0x01]);
    }

    sensorTag.setNotify('0xaa00', '0xaa01', config, function (err) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            sensorTag.write('0xaa00', '0xaa02', buf, function (err) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log('Temp set to ' + config);
                    callback(null);
                }
            });
        }
    });
}

function sensorTagAccelerometer (value, callback) {
    var config, buf;

    if (value === 0) {
        config = false;
        buf = new Buffer([0x00]);
    } else {
        config = true;
        buf = new Buffer([0x01]);
    }

    sensorTag.setNotify('0xaa10', '0xaa11', config, function (err) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            sensorTag.write('0xaa10', '0xaa12', buf, function (err) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log('Accelerometer set to ' + config);
                    callback(null);
                }
            });
        }
    });
}

function sensorTagHumidity (value, callback) {
    var config, buf;

    if (value === 0) {
        config = false;
        buf = new Buffer([0x00]);
    } else {
        config = true;
        buf = new Buffer([0x01]);
    }

    sensorTag.setNotify('0xaa20', '0xaa21', config, function (err) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            sensorTag.write('0xaa20', '0xaa22', buf, function (err) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log('Gyroscope set to ' + config);
                    callback(null);
                }
            });
        }
    });
}

/*****************************************************
 *    keyFob   API                                   *
 *****************************************************/
function sensorTagNotif () {
    var servUuidArr = ['0xaa00', '0xaa10', '0xaa20'],
        charUuid,
        val = new Buffer([0x01]);

    sensorTag.setNotify('0xffe0', '0xffe1', true, function (err) {
        if (!err) {
            sensorTagTemp(1, function (err) {
                if (!err) {
                    sensorTagAccelerometer(1, function (err) {
                        if (!err) {
                            sensorTagHumidity(1, function (err) {});
                        }
                    });
                }
            });
        }
    });

    
}

function keyFobAlert (keyFob, value) {
    keyFob.write('0x1802', '0x2a06', {alertLevel: value}, function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('keyFob alert set to ' + value);
        }
    });
}

/*****************************************************
 *    Plug   API                                   *
 *****************************************************/
function switchPlug (mode, callback) {
    var deferred = Q.defer(),
        val;

    if (mode === 'on') {
        val = new Buffer([0x41, 0x54, 0x43, 0x50, 0x00, 0x01, 0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, 0x87, 0x12, 0x8d, 0x01, 0x00, 0x00, 0x00]);
    } else {
        val = new Buffer([0x41, 0x54, 0x43, 0x50, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, 0x87, 0x12, 0x8d, 0x01, 0x00, 0x00, 0x00]);
    }


    if (plug.switch !== mode) {
        /*regularSetting(plug).then(function () {
            return*/ plug.write('0xf110', '0xf111', val)/*;
        })*/.then(function () {
            deferred.resolve();
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    } else {
        deferred.resolve();
    }
    
    return deferred.promise.nodeify(callback);
}

function connAndSwitchPlug (mode, callback) {
    var deferred = Q.defer(),
        emitObj = {
            devAddr: plug.addr,
            sensorType: '0xf110',
            value: mode
        };


    if (healBracelet.state !== 'online') {
        plug.connect().then(function () {
            console.log('Connect plug');
            return switchPlug(mode);
        }).then(function () {
            console.log('Switch On plug');
            plug.switch = mode;
            return plug.disconnect();
        }).then(function () {
            console.log('Disconnect plug');
            plug.state = 'pause';
            deferred.resolve();
        }).fail(function (err) {
            deferred.reject(err);
        });
    } else if (!plugFlag) {
        plugFlag = true;

        healBracelet.disconnect().then(function () {
            console.log('Disconnect bracelet');
            healBracelet.state = 'pause';
            return plug.connect();
        }).then(function () {
            console.log('Connect plug');
            return switchPlug(mode);
        }).then(function () {
            console.log('Switch On plug');
            plug.switch = mode;
            return plug.disconnect();
        }).then(function () {
            console.log('Disconnect plug');
            plug.state = 'pause';
            return healBracelet.connect();
        }).then(function () {
            console.log('connAndSwitchPlug done!!');
            healBracelet.write('0x1814', '0x2aff', new Buffer([0x00, 0x80, 0x00, 0x13]));
            healBracelet.regCharHdlr('0x1814', '0x2a53', callbackHeal);
            devmgr.findGad(plug.addr, 'ctrls', '0xf110').val = mode;
            io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
            setTimeout(function () {
                healBracelet.state = 'online';
            }, 500);
            deferred.resolve();
        }).fail(function (err) {
            console.log(err);
            healBracelet.connect();
            deferred.reject(err);
        }).finally(function () {
            plugFlag = false;
        }).done();
    } else {
        deferred.resolve();
    }

    return deferred.promise.nodeify(callback);
}
/*****************************************************
 *    Relay   API                                    *
 *****************************************************/
 function switchRelay (mode, callback) {
    var deferred = Q.defer();

    if (mode === 'on') {
        val = new Buffer([0x01]);
    } else {
        val = new Buffer([0x00]);
    }

    relay.read('0xaab0', '0xaab1').then(function (data) {
        if (data === new Buffer([0x00])) { relay.switch = 'off'; }
        if (data === new Buffer([0x01])) { relay.switch = 'on'; }
        if (relay.switch !== mode) {
            relay.write('0xaab0', '0xaab2', val).then(function () {
                deferred.resolve();
            }).fail(function (err) {
                deferred.reject(err);
            }).done();
        }
    }).fail(function (err) {
        deferred.reject(err); 
    }).done();
    

    return deferred.promise.nodeify(callback);
 }

 function connAndSwitchRelay (mode, callback) {
    var deferred = Q.defer(),
        emitObj = {
            devAddr: relay.addr,
            sensorType: '0xaab0',
            value: mode
        };


    if (healBracelet.state !== 'online') {
        relay.connect().then(function () {
            console.log('Connect relay');
            return switchRelay(mode);
        }).then(function () {
            console.log('Switch On relay');
            relay.switch = mode;
            return relay.disconnect();
        }).then(function () {
            console.log('Disconnect relay');
            relay.state = 'pause';
            deferred.resolve();
        }).fail(function (err) {
            deferred.reject(err);
        });
    }else if (!relayFlag) {
        relayFlag = true;

        healBracelet.disconnect().then(function () {
            console.log('Disconnect bracelet');
            healBracelet.state = 'pause';
            return relay.connect();
        }).then(function () {
            console.log('Connect relay');
            return switchRelay(mode);
        }).then(function () {
            console.log('Switch On relay');
            relay.switch = mode;
            return relay.disconnect();
        }).then(function () {
            console.log('Disconnect relay');
            relay.state = 'pause';
            return healBracelet.connect();
        }).then(function () {
            healBracelet.write('0x1814', '0x2aff', new Buffer([0x00, 0x80, 0x00, 0x13]));
            healBracelet.regCharHdlr('0x1814', '0x2a53', callbackHeal);
            console.log('connAndSwitchRelay done!!');
            devmgr.findGad(relay.addr, 'ctrls', '0xaab0').val = mode;
            io.sockets.emit('rsp', {type: 'attrInd', data: emitObj});
            setTimeout(function () {
                healBracelet.state = 'online';
            }, 500);
            deferred.resolve();
        }).fail(function (err) {
            console.log(err);
            healBracelet.connect();
            deferred.reject(err);
        }).finally(function () {
            relayFlag = false;
        }).done();
    } else {
        deferred.resolve();
    }

    return deferred.promise.nodeify(callback);
}    
/*************************************************************************************************/
/*** private function                                                                          ***/
/*************************************************************************************************/
function connectPauseDev (dev, callback) {
    var deferred = Q.defer(),
        pauseDev;
        flag = false;

    if (plug && plug.state === 'online') {
        flag = true;
        pauseDev = plug;
    } else if (relay && relay.state === 'online') {
        flag = true;
        pauseDev = relay;
    }

    if (flag) {
        pauseDev.disconnect().then(function () {
            pauseDev.state = 'pause';
            dev.state = 'offline';
            return dev.connect();
        }).then(function () {
            deferred.resolve(plug.addr);
        }).fail(function (err) {
            if (err.message === 'bleIncorrectMode') {
                setTimeout(function () {
                    connectPauseDev (dev);
                }, 1500);
                deferred.resolve();
            } else {
                deferred.reject(err);
            }
        }).done();
    } else {
        dev.state = 'offline';
        Q.delay(3000).then(function () {
            return dev.connect();
        }).then(function () {
            deferred.resolve();
        }).fail(function (err) {
            if (err.message === 'bleNoResources') {
                setTimeout(function () {
                    connectPauseDev (dev);
                }, 3000);
            }
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
}

function regularSetting (bPointPlug, callback) {
    var deferred = Q.defer();

    bPointPlug.write('0xf110', '0xf111', new Buffer([0x58, 0x54, 0x43, 0x08, 0x54, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5c, 0x00, 0x50, 0x4b, 0x25, 0x74, 0x01, 0x00, 0x00, 0x00])).then(function () {
        console.log('1--1');
        return bPointPlug.write('0xf110', '0xf111',new Buffer([0x58, 0x54, 0x43, 0x08, 0x54, 0x01, 0x00, 0x00, 0x00, 0x00, 0x5d, 0x00, 0x50, 0x4b, 0x25, 0x74, 0x01, 0x00, 0x00, 0x00]));
    }).then(function () {
        console.log('1--1');
        return bPointPlug.write('0xf110', '0xf111',new Buffer([0x58, 0x54, 0x43, 0x08, 0x54, 0x02, 0x00, 0x00, 0x00, 0x00, 0x5e, 0x00, 0x50, 0x4b, 0x25, 0x74, 0x01, 0x00, 0x00, 0x00]));
    }).then(function () {
        console.log('1--1');
        return bPointPlug.write('0xf110', '0xf111',new Buffer([0x58, 0x54, 0x43, 0x08, 0x54, 0x03, 0x00, 0x00, 0x00, 0x00, 0x5f, 0x00, 0x50, 0x4b, 0x25, 0x74, 0x01, 0x00, 0x00, 0x00]));
    }).then(function () {
        console.log('1--1');
        return bPointPlug.write('0xf110', '0xf111',new Buffer([0x58, 0x54, 0x43, 0x08, 0x54, 0x04, 0x00, 0x00, 0x00, 0x00, 0x60, 0x00, 0x50, 0x4b, 0x25, 0x74, 0x01, 0x00, 0x00, 0x00]));
    }).then(function () {
        deferred.resolve();
    }).fail(function (err) {
        deferred.reject('Regular error: ' + err);
    });

    return deferred.promise.nodeify(callback);
}
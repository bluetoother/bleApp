var io = require('socket.io'),
    _ = require('lodash'),
    Q = require('q');

var manager = require('../../ble-shepherd')('csr8510'),
    devmgr = require('../models/devmgr.js'),
    XivelyClient = require('../models/xively.js'),
    client = new XivelyClient();

var spCfg = {
        path: '/dev/ttyUSB0',
        options: {
            baudRate: 115200,
            rtscts: true,
            flowControl: true
        }
    },
    bleSocket,
    connFlag = false;

var nineAxis,
    pir,
    relay,
    remoteCtrl,
    weatherStation;

var tempValArr= [],
    humidValArr = [],
    baroValArr = [],
    uvValArr = [],
    accelerValArr = [],
    magnetValArr = [],
    gyroValArr = [];


client.setKey('ZE1QH7o7Zad9pGR5h6e95CPqpncGenX1qttOa5WuHSE5eF9D');

manager.enableBlackOrWhite(true, 'white');

manager.toWhite('0xd05fb820e4eb'); // remoteCtrl
manager.toWhite('0xd05fb820cc84'); // relay
manager.toWhite('0x5c313e2bfb34'); // pir
manager.toWhite('0x5c313e2bfb08'); // weatherStation
manager.toWhite('0xd05fb820c22a'); // 9Axis

exports.initialize = function(server) {
    io = io(server);

    io.on('connection', function (socket) {
        bleSocket = socket;

        socket.on('cmd', clientCmdHdlr);

        socket.on('getTemp', function () {
            socket.emit('sendTemp', tempValArr);
        });
        socket.on('getHumid', function () {
            socket.emit('sendHumid', humidValArr);
        });
        socket.on('getBaro', function () {
            socket.emit('sendBaro', baroValArr);
        });
        socket.on('getUv', function () {
            socket.emit('sendUv', uvValArr);
        });
        socket.on('getAcceler', function () {
            socket.emit('sendAcceler', accelerValArr);
        });
        socket.on('getMagnet', function () {
            socket.emit('sendMagnet', magnetValArr);
        });
        socket.on('getGyro', function () {
            socket.emit('sendGyro', gyroValArr);
        });

        socket.on('error', function (errMsg) {
            console.log('**********************************************');
            console.log('socket emitter error: ');
            console.log(errMsg);
            console.log('**********************************************');
        });
    });

    if (!connFlag) {
        manager.start(bleApp);
        connFlag = true;
    }
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
    manager.on('IND', indicationHdlr);
}

function indicationHdlr (msg) {
    var dev;

    switch (msg.type) {
        case 'DEV_INCOMING':
            dev = manager.find(msg.data);
            if (dev) 
                devIncomingHdlr(dev);
            break;
        case 'DEV_LEAVING':
        console.log(msg);
            dev = devmgr.find(msg.data);
            if (dev) 
                devLeavingHdlr(dev);
            break;
        case 'PASSKEY_NEED':
            break;
    }
}

function clientCmdHdlr (msg) {
    var data = msg.data,
        buzzerChar,
        relayChar,
        remoteCtrlChar;

    switch (msg.type) {
        case 'setNotify':
             dev = manager.find(data.devId);
             dev.setNotify(data.uuidServ, data.uuidChar, data.config);
            break;
        case 'write':
            dev = manager.find(data.devId);

            if (data.devId === relay.addr) {
                relayChar = relay.findChar(data.uuidServ, data.uuidChar);
                
                relayChar.val.onOff = data.val;
                relay.write(data.uuidServ, data.uuidChar, relayChar.val);
            }else if (data.devId === pir.addr) {
                buzzerChar = pir.findChar(data.uuidServ, data.uuidChar);
                buzzerChar.val.onOff = data.val;
                pir.write(data.uuidServ, data.uuidChar, buzzerChar.val);
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
function devIncomingHdlr (dev) {
    var emitFlag = true,
        devName = dev.findChar('0x1800', '0x2a00').val.name,
        newDev,
        nineAxisChar,
        weaMeasChar;

    dev.updateLinkParam(160, 0, 1000);

    switch (devName) {
        case 'Nine Axis Sensor':
            nineAxis = dev;

            nineAxis.regCharHdlr('0xbb30', '0xcc0f', accelerHdlr);
            nineAxis.regCharHdlr('0xbb30', '0xcc10', magnetHdlr);
            nineAxis.regCharHdlr('0xbb30', '0xcc24', gryoHdlr);

            nineAxisChar = nineAxis.findChar('0xbb30', '0xcc0a');
            nineAxisChar.val.onOff = true;
            nineAxis.write('0xbb30', '0xcc0a', nineAxisChar.val);
            break;
        case 'Remote Control':
            remoteCtrl = dev;

            remoteCtrl.regCharHdlr('0xbb70', '0xcc32', remoteCtrlHdlr);
            break;
        case 'Relay Module':
            relay = dev;

            relay.regCharHdlr('0xbb40', '0xcc0e', relayHdlr);
            break;
        case 'Gas Sht Sensor':
            pir = dev;

            pir.regCharHdlr('0xbb00', '0xcc00', pirHdlr);
            pir.regCharHdlr('0xbb60', '0xcc28', buzzerHdlr);

            var pirChar = pir.findChar('0xbb50', '0xcc0a');
            pirChar.val.onOff = true;
            pir.write('0xbb50', '0xcc0a', pirChar.val);
            pir.regCharHdlr('0xbb50', '0xcc07', temp2Hdlr);
            break;
        case 'Weather Station':
            weatherStation = dev;

            weatherStation.regCharHdlr('0xbb80', '0xcc07', tempHdlr);
            weatherStation.regCharHdlr('0xbb80', '0xcc08', humidHdlr);
            weatherStation.regCharHdlr('0xbb80', '0xcc05', uvHdlr);
            weatherStation.regCharHdlr('0xbb80', '0xcc11', barometerHdlr);

            weaMeasChar = weatherStation.findChar('0xbb80', '0xcc0a');
            weaMeasChar.val.onOff = true;
            weatherStation.write('0xbb80', '0xcc0a', weaMeasChar.val);
            break;
    }

    newDev = devmgr.newDev(dev);
    newDev.state = 'online';
    newDev.name = devName;
    io.sockets.emit('bleInd', {type: 'devIncoming', data: {addr: dev.addr, name: newDev.name}});

    newDev.notif = 'on';
}

function devLeavingHdlr (dev) {
    dev.state = 'offline';
    io.sockets.emit('bleInd', {
        type: 'devLeaving', 
        data: dev.addr
    });
}

/*************************************************************************************************/
/*** attribute ind/notif function                                                              ***/
/*************************************************************************************************/
function accelerHdlr(data) {
    var emitObj = {
            devAddr: nineAxis.addr,
            sensorType: '0xcc0f',
            name: 'Accelerometer',
            value: {
                x: data.xValue,
                y: data.yValue,
                z: data.zValue
            }
        },
        date = new Date();

    // console.log('Accelerometer sensed value');
    // console.log('X: ' + data.xValue + ' ' + data.units);
    // console.log('Y: ' + data.yValue + ' ' + data.units);
    // console.log('Z: ' + data.zValue + ' ' + data.units);

    accelerValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: emitObj.value.x,
        value2: emitObj.value.y,
        value3: emitObj.value.z
    });

    // judge data change

        // start buzzer
        // service : 0xbb20, char: 0xcc0f
    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function magnetHdlr(data) {
    var emitObj = {
            devAddr: nineAxis.addr,
            sensorType: '0xcc10',
            name: 'Magnetometer',
            value: {
                x: data.xValue,
                y: data.yValue,
                z: data.zValue
            }
        },
        date = new Date();

    // console.log('Magnetometer sensed value');
    // console.log('X: ' + data.xValue + ' ' + data.units);
    // console.log('Y: ' + data.yValue + ' ' + data.units);
    // console.log('Z: ' + data.zValue + ' ' + data.units);

    magnetValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: emitObj.value.x,
        value2: emitObj.value.y,
        value3: emitObj.value.z
    });

    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function gryoHdlr(data) {
    var pwrCtrlChar,
        emitObj = {
            devAddr: nineAxis.addr,
            sensorType: '0xcc24',
            name: 'Gyrometer',
            value: {
                x: data.xValue,
                y: data.yValue,
                z: data.zValue
            }
        },
        date = new Date();

    // console.log('Gyrometer sensed value');
    // console.log('X: ' + data.xValue + ' ' + data.units);
    // console.log('Y: ' + data.yValue + ' ' + data.units);
    // console.log('Z: ' + data.zValue + ' ' + data.units);

    gyroValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: emitObj.value.x,
        value2: emitObj.value.y,
        value3: emitObj.value.z
    });

    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function pirHdlr(data) {
    var pwrCtrlChar,
        emitObj = {
            devAddr: pir.addr,
            sensorType: '0xcc00',
            name: 'PIR',
            value: data.dInState
        };

    // console.log('PIR State: ' + data.dInState);
    // console.log('');
    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});

    if (data.dInState) {
        if (relay) {
            pwrCtrlChar = relay.findChar('0xbb40', '0xcc0e');
            pwrCtrlChar.val.onOff = true;
            relay.write('0xbb40', '0xcc0e', pwrCtrlChar.val);
        }
    } else {
        if (relay) {
            pwrCtrlChar = relay.findChar('0xbb40', '0xcc0e');
            pwrCtrlChar.val.onOff = false;
            relay.write('0xbb40', '0xcc0e', pwrCtrlChar.val);
        }
    }
}

function buzzerHdlr(data) {
    var emitObj = {
            devAddr: pir.addr,
            sensorType: '0xcc28',
            value: data.onOff
        };
    // console.log('Buzzer state: ' + data.onOff);
    // console.log('');
    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function relayHdlr(data) {
    var emitObj = {
            devAddr: relay.addr,
            sensorType: '0xcc0e',
            value: data.onOff
        };

    // console.log('Relay state: ' + data.onOff);
    // console.log('');
    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function remoteCtrlHdlr(data) {
    var weaMeasChar,
        buzzerChar,
        relayChar,
        nineAxisChar,
        emitObj = {
            devAddr: remoteCtrl.addr,
            sensorType: '0xcc32',
            value: 'off'
        };

    if (data.multistateInput === 1) {          // up
        // console.log('Remote Control State: Up');
        // console.log('');
        emitObj.value = 'up';

        weaMeasChar = weatherStation.findChar('0xbb80', '0xcc0a');
        weaMeasChar.val.onOff = true;
        weatherStation.write('0xbb80', '0xcc0a', weaMeasChar.val);
    } else if (data.multistateInput === 2) {   // down
        // console.log('Remote Control State: Down');
        // console.log('');
        emitObj.value = 'down';

        weaMeasChar = weatherStation.findChar('0xbb80', '0xcc0a');
        weaMeasChar.val.onOff = false;
        weatherStation.write('0xbb80', '0xcc0a', weaMeasChar.val);
    } else if (data.multistateInput === 4) {   // center
        // console.log('Remote Control State: Center');
        // console.log('');
        emitObj.value = 'center';

        buzzerChar = pir.findChar('0xbb60', '0xcc28');
        buzzerChar.val.onOff = !buzzerChar.val.onOff;
        pir.write('0xbb60', '0xcc28', buzzerChar.val);
    } else if (data.multistateInput === 8) {   // left
        // console.log('Remote Control State: Left');
        // console.log('');
        emitObj.value = 'left';

        relayChar = relay.findChar('0xbb40', '0xcc0e');
        relayChar.val.onOff = !relayChar.val.onOff;
        relay.write('0xbb40', '0xcc0e', relayChar.val);
    } else if (data.multistateInput === 16) {  // right
        // console.log('Remote Control State: Right');
        // console.log('');
        emitObj.value = 'right';

        nineAxisChar = nineAxis.findChar('0xbb30', '0xcc0a');
        nineAxisChar.val.onOff = !nineAxisChar.val.onOff;
        nineAxis.write('0xbb30', '0xcc0a', nineAxisChar.val);
    }       

    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});          
}

function tempHdlr(data) {
    var tempVal = data.sensorValue / 100,
        emitObj = {
            devAddr: weatherStation.addr,
            sensorType: '0xcc07',
            name: 'Temperature',
            value: tempVal
        },
        date = new Date();
    // console.log('Temperature sensed value: ' + data.sensorValue);

    tempValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: tempVal
    });

    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
    // feed value to cloud
}

function temp2Hdlr(data) {
    console.log('Temperature sensed value: ' + data.sensorValue);
}

function humidHdlr(data) {
    var humidVal = data.sensorValue / 100,
        emitObj = {
            devAddr: weatherStation.addr,
            sensorType: '0xcc08',
            name: 'Humidity',
            value: humidVal
        },
        date = new Date();

//     console.log('Humidity sensed value: ' + data.sensorValue);
//     console.log('');

    humidValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: humidVal
    });

    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function uvHdlr(data) {
    var uvVal = data.sensorValue,
        emitObj = {
            devAddr: weatherStation.addr,
            sensorType: '0xcc05',
            name: 'UV',
            value: uvVal
        },
        date = new Date();

    // console.log('UV sensed value: ' + data.sensorValue);

    uvValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: uvVal
    });
    
    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}

function barometerHdlr(data) {
    var baroVal = data.sensorValue,
        emitObj = {
            devAddr: weatherStation.addr,
            sensorType: '0xcc11',
            name: 'Barometer',
            value: baroVal
        },
        date = new Date();

    baroValArr.push({
        date: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
               date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
        value: baroVal
    });
    // console.log('Barometer sensed value: ' + data.sensorValue);
    io.sockets.emit('bleInd', {type: 'attrInd', data: emitObj});
}
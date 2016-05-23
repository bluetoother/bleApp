var _ = require('lodash');

var devmgr = {
    devs: []
};

devmgr.newDev = function (devInfo) {
    var dev = this.find(devInfo.addr);

    if (!dev) {
        dev = new Device (devInfo);
        this.devs.push(dev);

        if (dev.addr === '0xd05fb820e4eb') {
            dev.sensors.push({addr: dev.addr, name: 'Remote Control', path: 'remoteCtrl.png', id: '0xcc32', servId: '0xbb70', val: 'off', color: 'panel-success'});
        } else if (dev.addr === '0xd05fb820cc84') {
            dev.ctrls.push({addr: dev.addr, name: 'Lamp', path: 'lamp.png', id: '0xcc0e', servId: '0xbb40', val: 'off', color: 'panel-yellow'});
        } else if (dev.addr === '0x5c313e2bfb34') {
            dev.sensors.push({addr: dev.addr, name: 'PIR', path: 'pir.png', id: '0xcc00', servId: '0xbb00', val: 'off', color: 'panel-danger'});
            dev.ctrls.push({addr: dev.addr, name: 'Buzzer', path: 'buzzer.png', id: '0xcc28', servId: '0xbb60', val: 'off', color: 'panel-green'});
        } else if (dev.addr === '0x5c313e2bfb08') {
            dev.sensors.push({addr: dev.addr, name: 'Temperature', path: 'temp.png', id: '0xcc07', servId: '0xbb80', val: '0', unit: '°C', color: 'panel-warning'});
            dev.sensors.push({addr: dev.addr, name: 'Humidity', path: 'humidity.png', id: '0xcc08', servId: '0xbb80', val: '0', unit: '%', color: 'panel-info'});
            dev.sensors.push({addr: dev.addr, name: 'Barometer', path: 'barometer.png', id: '0xcc11', servId: '0xbb80', val: '0', unit: 'hPa', color: 'panel-danger'});
            dev.sensors.push({addr: dev.addr, name: 'UV', path: 'uv.png', id: '0xcc05', servId: '0xbb80', val: '0', unit: 'lux', color: 'panel-success'});
        } else if (dev.addr === '0xd05fb820c22a') {
            dev.sensors.push({addr: dev.addr, name: 'Accelerometer', path: 'accelerometer.png', id: '0xcc0f', servId: '0xbb30', val: 'X:0 Y:0 Z:0', color: 'panel-success'});
            dev.sensors.push({addr: dev.addr, name: 'Magnetometer', path: 'magnet.png', id: '0xcc10', servId: '0xbb30', val: 'X:0 Y:0 Z:0', color: 'panel-warning'});
            dev.sensors.push({addr: dev.addr, name: 'Gyrometer', path: 'gyrometer.png', id: '0xcc24', servId: '0xbb30', val: 'X:0 Y:0 Z:0', color: 'panel-info'});
        }
    }
    
    return dev;
};

devmgr.find = function (addr) {
    return _.find(this.devs, function (dev) {
        return dev.addr === addr;
    });
};

devmgr.findGad = function (addr, type, servUuid) {
    var dev = this.find(addr);

    return _.find(dev[type], function (gad) {
        return gad.id === servUuid;
    });
};

devmgr.remove = function (addr) {
    var dev = this.find(addr);

    if (dev) {
        this.devs.splice(_.indexOf(this.devs, dev), 1);
    }
};

function Device (devInfo) {
    this.name = null;
    this.role = devInfo.role;
    this.addr = devInfo.addr;
    this.addrType = devInfo.addrType;
    this.linkParams = devInfo.linkParams;
    this.servs = devInfo.servs;
    this.sm = devInfo.sm;
    this.state = 'online';
    this.ctrls = [];
    this.sensors = [];
}

module.exports = devmgr;
var express = require('express'),
    _ = require('lodash');

var devmgr = require('../models/devmgr');

/*************************************************************************************************/
/*** Web Application Router                                                                    ***/
/*************************************************************************************************/
var router = express.Router();

router.get('/', function (req, res, next) {
    var basicInfo = getBasicInfo();
    res.render('index', { title: 'Sivann',  devsInfo: basicInfo.devsInfo, ctrlDevs: basicInfo.ctrlDevs, sensorDevs: basicInfo.sensorDevs });
});

router.get('/devs', function (req, res, next) {
    var devsInfo = [],
        basicInfo = getBasicInfo();

    _.forEach(devmgr.devs, function (dev) {
        devsInfo.push({name: dev.name, addr: dev.addr, status: dev.state, ctrls: _.cloneDeep(dev.ctrls), sensors: _.cloneDeep(dev.sensors)});
    });

    res.render('devsTable', { title: 'Sivann', devsInfo: devsInfo, ctrlDevs: basicInfo.ctrlDevs, sensorDevs: basicInfo.sensorDevs });
});

router.get('/devs_:id', function (req, res) {
    var basicInfo = getBasicInfo(),
        url = req.params.id,
        dev = devmgr.find(url.slice(0, 14)),
        app = devmgr.findGad(dev.addr, 'ctrls', url.slice(15));

    if (!app) {
        app = devmgr.findGad(dev.addr, 'sensors', url.slice(15));
    }

    dev = {name: dev.name, addr: dev.addr, status: dev.state, notif: dev.notif};

    res.render('appInfo', { title: 'Sivann', ctrlDevs: basicInfo.ctrlDevs, sensorDevs: basicInfo.sensorDevs, dev: dev, app: app});
});

function getBasicInfo () {
    var devsInfo = _.map(devmgr.devs, function (dev) {
            return { addr: dev.addr, name: dev.name };
        }),
        ctrlDevs = [],
        sensorDevs = [];

    _.forEach(devmgr.devs, function (dev) {
        if (_.size(dev.ctrls) !== 0) {
            ctrlDevs = ctrlDevs.concat(dev.ctrls);
        }

        if (_.size(dev.sensors) !== 0) {
            sensorDevs = sensorDevs.concat(dev.sensors);
        }
    });

    return {devsInfo: devsInfo, ctrlDevs: ctrlDevs, sensorDevs: sensorDevs};
}

module.exports = router;

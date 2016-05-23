var socket = io.connect('http://192.168.1.107:3000/'),
    chartData = [],
    chart,
    sensorType = $('#sensorType').children().children().html();

// var chartData = generateChartData();

socket.on('bleInd', function(msg) {
    var data = msg.data;

    if (msg.type === 'attrInd') {
        var date = new Date(),
            time = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
                   date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();

        
        if (data.name === sensorType) {
            addDataPoint(time, data.value);
            if (data.name === 'Accelerometer' || data.name === 'Magnetometer' || data.name === 'Gyrometer')
                $('#value').children().html('x: ' + data.value.x + ', y: ' + data.value.y + ', z: ' + data.value.z);
            else
                $('#value').children().html(data.value);
        }
    } else if (msg.type === 'devLeaving') {
        $('#status').children().html('offline');
    } else if (msg.type === 'devIncoming') {
        $('#status').children().html('online');
    }
});

socket.on('sendTemp', addDataPoints);
socket.on('sendHumid', addDataPoints);
socket.on('sendBaro', addDataPoints);
socket.on('sendUv', addDataPoints);
socket.on('sendAcceler', addDataPoints);
socket.on('sendMagnet', addDataPoints);
socket.on('sendGyro', addDataPoints);
function addDataPoints(data) {
    chartData = data;
    chart.dataSets[0].dataProvider = chartData; 

    chart.validateData();
}


$(function() {    
    chart = AmCharts.makeChart("chartdiv", {
        type: "stock", //stock
        theme: "none", //none
        pathToImages: "http://www.amcharts.com/lib/3/images/",
        glueToTheEnd: true,

        categoryAxesSettings: {
            minPeriod: "1500fff"
        },

        dataSets: [{
            // color: "#b0de09",
            fieldMappings: [{
                fromField: "value",
                toField: "value"
            }, {
                fromField: "value2",
                toField: "value2"
            }, {
                fromField: "value3",
                toField: "value3"
            }],

            dataProvider: chartData,
            categoryField: "date"
        }],

        panels: [{
                showCategoryAxis: true,
                title: "Value",
                percentHeight: 70,

                valueAxes: [{
                    id: "v1",
                    axisColor: "#FF6600"
                }, {
                    id: "v2",
                    position: "right",
                    axisColor: "#FCD202",
                }, {
                    id: "v3",
                    position: "right",
                    offset: 50,
                    axisColor: "#B0DE09",
                }],

                stockGraphs: [{
                    id: "g1",
                    valueField: "value",
                    lineThickness: 2,
                    bullet: "round",
                    lineColor: "#FF6600"
                }, {
                    valueAxis: "v2",
                    valueField: "value2",
                    lineThickness: 2,
                    bullet: "round",
                    lineColor: "#FCD202",
                    useDataSetColors: false
                }, {
                    valueAxis: "v3",
                    valueField: "value3",
                    lineThickness: 2,
                    bullet: "round",
                    lineColor: "#B0DE09",
                    useDataSetColors: false
                }],

                stockLegend: {
                    valueTextRegular: " ",
                    markerType: "none"
                }
            }
        ],

        chartScrollbarSettings: {
            graph: "g1",
            usePeriod: "ss",
            position: "top",
            autoGridCount: false
        },

        chartCursorSettings: {
            valueBalloonsEnabled: true
        },

        periodSelector: {
            position: "top",
            dateFormat: "YYYY-MM-DD JJ:NN:SS",
            inputFieldWidth: 150,
            periods: [{
                period: "mm",
                count: 1,
                label: "1 minute",
                selected: true

            }, {
                period: "mm",
                count: 5,
                label: "5 minutes",
                selected: true

            }, {
                period: "mm",
                count: 30,
                label: "30 minutes",
                selected: true

            }, {
                period: "hh",
                count: 1,
                label: "1 hour",
                selected: true

            }, {
                period: "MAX",
                label: "MAX"
            }]
        },

        panelsSettings: {
            usePrefixes: true
        }
    });

    sensorType = $('#sensorType').html();

    /*if (sensorType === 'PIR') {
        socket.on('sendPir', addDataPoint);
        socket.emit('getPir');
    } else*/ if (sensorType === 'Temperature') {
        socket.emit('getTemp');
    } else if (sensorType === 'Humidity') {
        socket.emit('getHumid');
    } else if (sensorType === 'Barometer') {
        socket.emit('getBaro');
    } else if (sensorType === 'UV') {
        socket.emit('getUv');
    } else if (sensorType === 'Accelerometer') {
        socket.emit('getAcceler');
        addLengend();
    } else if (sensorType === 'Magnetometer') {
        socket.emit('getMagnet');
        addLengend();
    } else if (sensorType === 'Gyrometer') {
        socket.emit('getGyro');
        addLengend();
    }

    $('.switchOn').click(function() {
        var devId = $('#devId').html(),
            uuidServ = $(this).parent().attr('servId'),
            uuidChar = $(this).parent().attr('charId');

        $('#notif').children().html('on');
        socket.emit('cmd', {type: 'setNotify', data: {devId: devId, uuidServ: uuidServ, uuidChar: uuidChar, config: true}});
    });

    $('.switchOff').click(function() {
        var devId = $('#devId').html(),
            uuidServ = $(this).parent().attr('servId'),
            uuidChar = $(this).parent().attr('charId');

        $('#notif').children().html('off');
        socket.emit('cmd', {type: 'setNotify', data: {devId: devId, uuidServ: uuidServ, uuidChar: uuidChar, config: false}});
    });
});

function addDataPoint(date, value) {
    var newData = {
            date: date,
            value: value
        },
        dataProvider = chart.dataSets[0].dataProvider; 

    if (typeof value === 'object') {
        newData.value = value.x;
        newData.value2 = value.y;
        newData.value3 = value.z;
    }
    dataProvider.push(newData);
    // dataProvider.shift();
    chart.validateData();
}

function addLengend () {
    chart.panels[0].stockGraphs[0].title = 'x';
    chart.panels[0].stockGraphs[1].title = 'y';
    chart.panels[0].stockGraphs[2].title = 'z';

    chart.legendSettings = {
        "useGraphSettings": true
    };

    // chart.validateNow();
}


//http://jsfiddle.net/amcharts/ATQUm/
//https://www.amcharts.com/tutorials/formatting-dates/
//https://docs.amcharts.com/javascriptstockchart/AmStockChart#
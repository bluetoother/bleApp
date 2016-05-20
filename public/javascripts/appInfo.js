var socket = io.connect('http://192.168.1.107:3000/'),
	chartData = [],
	chart,
    sensorType = $('#sensorType').html();

socket.on('bleInd', function(msg) {
	var data = msg.data;

	if (msg.type === 'attrInd') {
		var date = new Date(),
            time = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
                   date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();

        if (data.sensorType === '0xcc24' || data.sensorType === '0xcc00' || data.sensorType === '0xcc07' ||
            data.sensorType === '0xcc08' || data.sensorType === '0xcc11' || data.sensorType === '0xcc05' ||
            data.sensorType === '0xcc0f' || data.sensorType === '0xcc10') {

            addDataPoint(time, data.value);
            $('#value').children().html(data.value);
        }
	} else if (msg.type === 'devLeaving') {
    	$('#status').children().html('offline');
    } else if (msg.type === 'devIncoming') {
    	$('#status').children().html('online');
    }
});

function addDataPoint(data) {
    chartData = msg;
    chart.dataSets[0].dataProvider = chartData; 

    chart.validateData();
}


$(function() {
	if (sensorType === 'PIR') {
        socket.on('sendPir', addDataPoint);
        socket.emit('getPir');
    } else if (sensorType === 'Temperature') {
        socket.on('sendTemp', addDataPoint);
        socket.emit('getTemp');
    } else if (sensorType === 'Humidity') {
        socket.on('sendHumid', addDataPoint);
        socket.emit('getHumid');
    } else if (sensorType === 'Barometer') {
        socket.on('sendBaro', addDataPoint);
        socket.emit('getBaro');
    } else if (sensorType === 'UV') {
        socket.on('sendUv', addDataPoint);
        socket.emit('getUv');
    } else if (sensorType === 'Accelerometer') {
        socket.on('sendAcceler', addDataPoint);
        socket.emit('getAcceler');
    } else if (sensorType === 'Magnetometer') {
        socket.on('sendMagnet', addDataPoint);
        socket.emit('getMagnet');
    } else if (sensorType === 'Gyrometer') {
        socket.on('sendGyro', addDataPoint);
        socket.emit('getGyro');
    }

	chart = AmCharts.makeChart("chartdiv", {

	        type: "stock",
	        "theme": "none",
	        pathToImages: "http://www.amcharts.com/lib/3/images/",
	    	glueToTheEnd: true,

	        categoryAxesSettings: {
	            minPeriod: "1500fff"
	        },

	        dataSets: [{
	            color: "#b0de09",
	            fieldMappings: [{
	                fromField: "value",
	                toField: "value"
	            }, {
	                fromField: "volume",
	                toField: "volume"
	            }],

	            dataProvider: chartData,
	            categoryField: "date"
	        }],


	        panels: [{
	                showCategoryAxis: true,
	                title: "Value",
	                percentHeight: 70,

	                stockGraphs: [{
	                    id: "g1",
	                    valueField: "value",
	                    // type: "smoothedLine",
	                    lineThickness: 2,
	                    bullet: "round",
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

		$('.switchOn').click(function() {
			$('#notif').children().html('on');
			socket.emit('req', {type: 'setNotify', data: {devId: '0x9059af0b8159', uuidServ: '0xaa00', uuidChar: '0xaa01', config: true}});
		});

		$('.switchOff').click(function() {
			$('#notif').children().html('off');
			socket.emit('req', {type: 'setNotify', data: {devId: '0x9059af0b8159', uuidServ: '0xaa00', uuidChar: '0xaa01', config: false}});
		});
});

function addDataPoint(date, value) {
	var dataProvider = chart.dataSets[0].dataProvider; 

    dataProvider.push({
        date: date,
        value: value
    });
    // dataProvider.shift();
    chart.validateData();
}

//http://jsfiddle.net/amcharts/ATQUm/
//https://www.amcharts.com/tutorials/formatting-dates/
//https://docs.amcharts.com/javascriptstockchart/AmStockChart#
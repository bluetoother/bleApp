var socket = io.connect('http://192.168.1.107:3000/');

var tempChart;

socket.on('bleInd', function (msg) {
    var data = msg.data;
    
    switch (msg.type) {
        case 'devIncoming':
            alert('Device Incoming');
            
            $('li.dev').append('<a href="devs_' + data.addr + '">' +  data.name + '</a>');
            break;
        case 'devLeaving':
            if ($('#devAddr').html() === data) {
                $('div.main').children().eq(2).children().eq(1).html('offline');
            }
            break;
        case 'attrInd':
            var date = new Date(),
                time = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();

            if (data.sensorType === '0xcc0f' || data.sensorType === '0xcc10' || data.sensorType === '0xcc24') {
                $('#' + data.sensorType).html('<p class="midium"> X:' + data.value.x + ' Y:' + data.value.y + ' Z:' + data.value.z + '</p>');
            } else {
                $('#' + data.sensorType).html('<p class="nowrap">' + data.value  + '</p>');
            }
            break;
    }
});

$(function () {
    $('#removeDevBtn').click(function () {
        var devId = $('#devAddr').html(),
            emitObj = {
                type: 'rmvDev',
                data: devId
            };
        socket.emit('cmd', emitObj);
        $('li.dev').children().each(function () {
            if ($(this).attr('href') === '/devs_' + devId) {
                $(this).remove();
                window.location.href = 'http://192.168.10.129:3000';
            }
        });
    });

    $('.switchOn').click(function () {
        precessWriteVal($(this), true);
    });
    $('.switchOff').click(function () {
        precessWriteVal($(this), false);
    });   

    $('.switchUp').click(function () {
        precessWriteVal($(this), 1);
    }); 
    $('.switchDown').click(function () {
        precessWriteVal($(this), 2);
    }); 
    $('.switchCenter').click(function () {
        precessWriteVal($(this), 4);
    }); 
    $('.switchLeft').click(function () {
        precessWriteVal($(this), 8);
    }); 
    $('.switchRight').click(function () {
        precessWriteVal($(this), 16);
    }); 

});

function precessSetNotif (context, config) {
    var devId = $('#devAddr').html(),
        servId = context.parent().parent().parent().attr('id'),
        charId = '0x' + (parseInt(servId) + 1).toString(16),
        emitObj = {
            type: 'setNotify',
            data: {
                devId: devId,
                uuidServ: servId,
                uuidChar: charId,
                config: config
            }
        };

    socket.emit('cmd', emitObj);
}

function precessWriteVal (context, val) {
    var devId = context.parent().attr('devId'),
        servId = context.parent().attr('servId'),
        charId = context.parent().attr('charId'),
        emitObj = {
            type: 'write',
            data: {
                devId: devId,
                uuidServ: servId,
                uuidChar: charId,
                val: val
            }
        };

    socket.emit('cmd', emitObj);
}


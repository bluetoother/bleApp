var socket = io.connect('http://192.168.1.107:3000/');

var tableData = [];

socket.on('bleInd', function (msg) {
    var data = msg.data,
        tds,
        tdLen,
        dev;

    tds = $('tr').find('td.id');
    tdLen = tds.length;


	if (msg.type === 'devLeaving') {
    	for (var i = 0; i < tdLen; i += 1) {
    		dev = tds.eq(i);

	        if (dev.html() === data) {
	        	dev.next().html('offline');
	        }
	    }
    } else if (msg.type === 'devIncoming') {
    	for (var i = 0; i < tdLen; i += 1) {
    		dev = tds.eq(i);
	        if (dev.html() === data.addr && dev.next().html() === 'offline') {
	        	dev.next().html('online');
	        }
	    }
    }
});

$(function () {
    var tds,
        tdLen;

    $('#table').bootstrapTable({
        idField: 'name',
        pagination: true,
        search: true,
        // url: '/gh/get/response.json/wenzhixin/bootstrap-table/tree/master/docs/data/data1/',
        data: tableData/*,
        onPostBody: function () {
            $('#table').editableTableWidget({editor: $('<textarea>')});
        }*/
    });

    tds = $('tr').find('td');
    tdLen = tds.length;
    for (var i = 0; i < tdLen; i += 1) {
        if(tds.eq(i).text() === '-') {
            tds.eq(i).remove();
        }
    }
    $(this).find('tbody').eq(0).remove();

    // $('.remove').html('<button type="button" class="btn btn-danger btn-circle"><i class="fa fa-times"></i>
    //                         </button>');
	$('.remove').html('<button type="button" class="btn btn-danger btn-circle "><i class="fa fa-times"></button>');
	$('.remove').click(function() {
		var addr = $(this).next().next().html();
		if ($(this).attr('rowspan') === '3') {
			for (i = 0; i < 2; i += 1) {
				$(this).parent().next().remove();
			}
			$(this).parent().remove();
		} else if ($(this).attr('rowspan') === '4') {
			for (i = 0; i < 3; i += 1) {
				$(this).parent().next().remove();
			}
			$(this).parent().remove();
		} else {
			$(this).parent().remove();
		}
		socket.emit('req', {type: 'rmvDev', data: addr});
	});
    
});

var devAddr;
function actionFormatter(value, row, index) {
    var href = 'devs_';

    if (_.startsWith(row.devaddr, '0x')) {
        devAddr = row.devaddr;
    }

    href = href + devAddr + '_' + row._id;
    return [
        '<a class="like" href=' + href + ' title="Like">',
        '<i class="glyphicon glyphicon-new-window"></i>',
        '</a>'
    ].join('');
}

function rmvDevFormatter (value, row, index) {
    return [
        '<a class="like" href="#" title="Like">',
        '<i class="glyphicon glyphicon-new-window"></i>',
        '</a>'
    ].join('');
}

// window.actionEvents = {
//     'click .remove': function (e, value, row, index) {
//         alert(row.devaddr);
//         socket.emit('req', row.devaddr);
//     }
// };

function totalTextFormatter(data) {
    return 'Total';
}

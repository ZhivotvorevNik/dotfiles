var exec = require('child_process').exec;
var packName = 'sendIcon.js';
var fileName, serviceName, dev, instance, flags, extention, tmpFileName, i;

// node sendIcon filename serviceName instance -flags
if (!process.argv[2]) {
    printHelp('No fileName');
    return;
} else {
    fileName = process.argv[2];
    tmpFileName = '_tmp_' + fileName;
    extention = fileName.split('.');
    extention = extention[extention.length - 1];
}

if (!process.argv[3]) {
    printHelp('No service name');
    return;
} else {
    serviceName = process.argv[3];
}

if (!process.argv[4]) {
    printHelp('No instance');
    return;
} else {
    dev = process.argv[4].split('d')[0];
    instance = process.argv[4].split(dev)[1];
}

if (!process.argv[5]) {
    printHelp('No flags');
    return;
} else {
    flags = process.argv[5].split('-')[1].split('');
}

function printHelp(str) {
    str += '\n\n' +
        'node ' + packName + ' {file name} {service name} {instance} {flags} \n' +
        'instance like v25d1, v5d3\n' +
        'Flags:\n' +
        '-b - for big icons\n' +
        '-s - for small icons\n' +
        '-4 - for 404 icons\n' +
        '-t - for com.tr icons\n';
    console.log(str);
}

exec('chmod 664 ' + fileName, function(error, stdout, stderr){
    logIt(stdout, stderr);
    if (stderr) {return;}
});

exec('cp ' + fileName + ' ' + tmpFileName, function(error, stdout, stderr){
    logIt(stdout, stderr);
    if (stderr) {return;}
});

if (extention === 'svg') {
    svgSend(tmpFileName, 5);
}

if (extention === 'png') {
    pngSend(tmpFileName);
}

function svgSend(fileName, times) {
    doStaff();
    function doStaff() {
        exec('svgo -i ' + fileName + ' -o ' + fileName + ' --multipass -p 2', function(error, stdout, stderr) {
            logIt(stdout, stderr);
            if (stderr) {return;}
            if (times--) {
                doStaff();
            }
            if (!times) {
                sendFile();
            }
        });
    }
}

function pngSend(tmpFileName) {
    var command = 'optipng ' + tmpFileName + ' -o7';
    console.log(command);
    exec(command, function(error, stdout, stderr) {
        logIt(stdout, stderr);
        if (stderr) {return;}
    });
    setTimeout(sendFile, 300);
}



function scp_big(tmpFileName, serviceName, extention, tr) {
    var command = 'scp ' + tmpFileName + ' ' + dev + '.wdevx.yandex.net:/opt/www/morda-' + dev + instance + '/tmpl/everything/blocks/common-all/services-main/services-main.inline/' + serviceName + (tr ? '_tr' : '') + '.' + extention;
    console.log(command)
    exec(command, function(error, stdout, stderr) {
        logIt(stdout, stderr);
        if (stderr) {return;}
        console.log('Big ' + extention + ' icon for all sent')
    });
}



function scp_small(tmpFileName, serviceName, extention, tr) {
    var command = 'scp ' + tmpFileName + ' ' + dev + '.wdevx.yandex.net:/opt/www/morda-' + dev + instance + '/tmpl/everything/blocks/common-all/services-all/services-all.inline/' + serviceName + '_small' + (tr ? '_tr' : '') + '.' + extention;
    console.log(command);
    exec(command, function(error, stdout, stderr) {
        logIt(stdout, stderr);
        if (stderr) {return;}
        console.log('Small ' + extention + ' icon for all sent');
    });
}

function scp_404(tmpFileName, serviceName, extention, tr) {
    var command = 'scp ' + tmpFileName + ' ' + dev + '.wdevx.yandex.net:/opt/www/morda-' + dev + instance + '/tmpl/white/blocks/404/services/services.inline/service-' + serviceName + (tr ? '_tr' : '') + '.' + extention;
    console.log(command);
    exec(command, function(error, stdout, stderr) {
        logIt(stdout, stderr);
        if (stderr) {return;}
        console.log(extention + ' icon for 404 sent');
    });

    
}


function logIt (stdout, stderr) {
    console.log(stdout);
    if (stderr) {
        console.log(stderr);
    }
}

function sendFile() {
    console.log(flags)
    var tr = (flags.indexOf('t') >=0 );

    if (flags.indexOf('b') >= 0) {
        scp_big(tmpFileName, serviceName, extention, tr);
    }
    if (flags.indexOf('s') >= 0) {
        scp_small(tmpFileName, serviceName, extention, tr);
    }
    if (flags.indexOf('4') >= 0) {
        scp_404(tmpFileName, serviceName, extention, tr);
    }
}


// exec('ls -a', function(error, stdout, stderr){
//  console.log(stdout);
//  if(stderr) {
//      console.log(stderr)
//  };
//});

document.getElementById('generateButton').addEventListener('click', function() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (file) {
        showLoader();
        readAndProcessFile(file);
    }
});

function showLoader() {
    document.getElementById('overlay').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('overlay').style.display = 'none';
}

function readAndProcessFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (isValid2FASFile(data)) {
                generateQRCodes(data);
            } else {
                alert('The uploaded file is not a valid .2fas file.');
                hideLoader();
            }
        } catch (error) {
            alert('Error reading the file. Please ensure the file is a valid JSON.');
            console.error(error);
            hideLoader();
        }
    };
    reader.onerror = function() {
        alert('Error reading the file.');
        hideLoader();
    };
    reader.readAsText(file);
}

function isValid2FASFile(data) {
    const hasSecret = data.services && data.services.some(service => 'secret' in service);
    const hasAppVersionCode = 'appVersionCode' in data;
    const hasValidSchemaVersion = 'schemaVersion' in data && data.schemaVersion >= 4;

    return hasSecret && hasAppVersionCode && hasValidSchemaVersion;
}

function generateQRCodes(data) {
    if (!data.services) {
        console.error('Invalid file format');
        hideLoader();
        return;
    }

    const zip = new JSZip();
    const folder = zip.folder('qrcodes');

    let promises = data.services.map(service => {
        if (service.secret) {
            return generateAndAddQRToZip(service, folder);
        }
    }).filter(p => p !== undefined);

    Promise.all(promises).then(() => {
        zip.generateAsync({type: "blob"})
            .then(function(content) {
                saveAs(content, "qrcodes.zip");
                hideLoader();
            });
    });
}

function addWhiteBorderToQR(qrCanvas, borderSize) {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');

    var newWidth = qrCanvas.width + 2 * borderSize;
    var newHeight = qrCanvas.height + 2 * borderSize;
    canvas.width = newWidth;
    canvas.height = newHeight;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, newWidth, newHeight);

    context.drawImage(qrCanvas, borderSize, borderSize);

    return canvas;
}

function generateAndAddQRToZip(service, folder) {
    return new Promise(resolve => {
        const otpUrl = generateOTPUrl(service);
        const qrContainer = document.createElement('div');

        const qr = new QRCode(qrContainer, {
            text: otpUrl,
            width: 512,
            height: 512,
            typeNumber: 4,
            colorDark: "#200000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L,
        });

        setTimeout(() => {
            var qrCanvas = qrContainer.querySelector('canvas');
            var canvasWithBorder = addWhiteBorderToQR(qrCanvas, 16);

            const qrImage = canvasWithBorder.toDataURL("image/png");
            const account = service.otp && service.otp.account ? `${service.otp.account.replace(/@/g, '_').replace(/\./g, '_')}` : '';
            const filename = `${service.name}${account ? '_' + account : ''}.png`;

            folder.file(filename, qrImage.split(',')[1], {base64: true});
            resolve();
        }, 500);
    });
}

function generateOTPUrl(service) {
    const account = encodeURIComponent(service.otp && service.otp.account ? service.otp.account : '');
    const issuer = encodeURIComponent(service.name);
    const secret = encodeURIComponent(service.secret);
    const algorithm = encodeURIComponent(service.otp && service.otp.algorithm ? service.otp.algorithm : 'SHA1');
    const digits = encodeURIComponent(service.otp && service.otp.digits ? service.otp.digits : 6);
    const period = encodeURIComponent(service.otp && service.otp.period ? service.otp.period : 30);

    return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}

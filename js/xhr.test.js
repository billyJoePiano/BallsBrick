"use strict";

(function xhrTest() {
    const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-';

    function encode64(num) {
        //encodes a number to base-64
        if (typeof num !== 'number') {
            throw new Error('Value is not number!');
        }

        let result = '';
        let mod;
        do {
            mod = num % 64;
            result = ALPHABET.charAt(mod) + result;
            num = Math.floor(num / 64);

        } while(num > 0);

        return result;
    }

    let form = document.getElementById('form');
    let checkboxes = [];
    for (let element of document.getElementsByTagName('input')) {
        if (element.type === 'checkbox') checkboxes.push(element);
    }

    document.getElementById('submit').onclick = function(event) {
        let formData = new FormData(form);
        for (let field of checkboxes) {
            if (field.checked) continue;
            formData.delete(field.id.slice(0, -7)); //removes the 'Include' from end of id
        }
        let xhr = new XMLHttpRequest();
        let url = 'drafts.php?' + encode64(Date.now());

        xhr.open('POST', url);
        xhr.send(formData);
        let time = new Date();
        console.log(xhr);

        let request = document.body.insertBefore(
                document.createElement('pre'),
                document.body.children[1]               );
        let title = request.appendChild(document.createElement('span'));
        title.classList.add('header');

        title.innerText = (((time.getHours() + 11) % 12) + 1) + ':'
                + ('0' + time.getMinutes()).slice(-2) + ':'
                + ('0' + time.getSeconds()).slice(-2)
                + (time.getHours() < 12 ? 'am' : 'pm')
                + ' POST to ' + url;


        for(let pair of Array.from(formData.entries())) {
            let key = request.appendChild(document.createElement('span'));
            key.classList.add('key');
            key.innerText = pair[0];

            let value = request.appendChild(document.createElement('span'));
            value.classList.add('value');
            value.innerText = pair[1];
        }

        xhr.onload = function() {
            let response = document.body.insertBefore(
                    document.createElement('pre'),
                    document.body.children[1]               );

            let header = response.appendChild(document.createElement('span'));
            header.classList.add('header');
            header.innerText = xhr.getAllResponseHeaders();

            response.appendChild(document.createElement('hr'));

            let body = response.appendChild(document.createElement('span'));
            body.innerText = xhr.responseText;

            let doc;
            let button = response.appendChild(document.createElement('button'));
            button.innerText = 'Turn to webpage';
            button.onclick = turnToHTML;

            function turnToHTML() {
                doc ??= document.createElement('iframe');
                response.appendChild(doc);
                doc.contentDocument.write(xhr.responseText);
                button.onclick = removeHTML;
                button.innerText = 'Remove webpage';
            }

            function removeHTML() {
                doc.remove();
                button.onclick = turnToHTML;
                button.innerText = 'Turn to webpage';
            }
        }
        return false;
    }

})();
const screenshotCanvasElement = document.getElementById("screenshotCanvas");
const myPeerIdElement = document.getElementById("myPeerId");
const otherPeerIdElement = document.getElementById("otherPeerId");
const peerSubmitElement = document.getElementById("peerSubmit");
const peerFormElement = document.getElementById("peerForm");
const peerDisconnectElement = document.getElementById("peerDisconnect");
const myVideoElement = document.getElementById("myVideo");
const peerVideoElement = document.getElementById("peerVideo");
const deafenElement = document.getElementById("deafen");
const muteElement = document.getElementById("mute");
const volumeElement = document.getElementById("volume");
const peerLogElement = document.getElementById("peerLog");
const peerChatMessagesElement = document.getElementById("peerChatMessages");
const peerChatFormElement = document.getElementById("peerChatForm");
const peerChatMessageElement = document.getElementById("peerChatMessage");
const peerChatSubmitElement = document.getElementById("peerChatSubmit");
const shareDialogElement = document.getElementById("shareDialog");
const shareQrElement = document.getElementById("shareQr");
const shareUrlElement = document.getElementById("shareUrl");
const shareCloseElement = document.getElementById("shareClose");

const screenshotCanvasContext = screenshotCanvasElement.getContext("2d");

const queryParams = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

function downloadURI(uri, name) {
    const link = document.createElement("a");
    link.download = name;
    link.href = uri;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    delete link;
}

function screenshotElement(videoElement) {
    screenshotCanvasElement.width = videoElement.videoWidth;
    screenshotCanvasElement.height = videoElement.videoHeight;

    screenshotCanvasContext.drawImage(videoElement, 0, 0);
    const dataURI = screenshotCanvasElement.toDataURL("image/png");
    downloadURI(dataURI, "screenshot.png");
}

function updateQueryStringParameter(uri, key, value) {
    const re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    const separator = uri.indexOf('?') !== -1 ? "&" : "?";

    if (uri.match(re)) {
        return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
        return uri + separator + key + "=" + value;
    }
}

function generateId(len = 6) {
    return Math.random().toString().substr(2, len);
}

function peerLog(str) {
    peerLogElement.innerHTML = str;
}

function setDeafened(bool) {
    peerVideoElement.muted = bool;
}

function setVolumePercentage(num) {
    peerVideoElement.volume = num / 100;
}

deafenElement.addEventListener("change", (event) => {
    setDeafened(event.target.checked);
});
setDeafened(deafenElement.checked);

volumeElement.addEventListener("change", (event) => {
    setVolumePercentage(event.target.value);
});
setVolumePercentage(volumeElement.value);

otherPeerIdElement.value = queryParams.id ? queryParams.id : "";

const peer = new Peer(generateId());
const constraints = {
    audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: {
        height: { min: 640, ideal: 1920, max: 1920 },
        width: { min: 400, ideal: 1080, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 30 }
    }
};

peer.on("open", (myId) => {
    peerLog("Peer Open");

    let communication = {
        call: null,
        connection: null
    }

    myPeerIdElement.innerHTML = myId;
    myPeerIdElement.setAttribute("aria-busy", "false");
    myPeerIdElement.classList.add("generated");
    myPeerIdElement.addEventListener("click", (event) => {
        shareDialogElement.open = true;

        shareCloseElement.addEventListener("click", () => {
            shareDialogElement.open = false;
        }, { once: true });
    });

    const shareUrl = updateQueryStringParameter(window.location.href, "id", myId)
    new QRCode(shareQrElement, shareUrl);
    shareUrlElement.href = shareUrl;

    myVideoElement.addEventListener("click", (event) => {
        screenshotElement(event.target);
    });

    peerVideoElement.addEventListener("click", (event) => {
        screenshotElement(event.target);
    });

    peerFormElement.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const formData = new FormData(event.target);
        const otherID = formData.get("otherPeerId");
        if (otherID.length != 6) return;
        peerLog("Form Submitted");

        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            window.myStream = stream;

            communication.call = peer.call(otherID, stream);
            communication.connection = peer.connect(otherID);
            initCommunication(communication)
        });
    });

    peer.on("call", (call) => {
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            window.myStream = stream;

            call.answer(stream);
            communication.call = call;

            if (communication.connection != null) {
                initCommunication(communication);
            }
        });
    });

    peer.on("connection", (connection) => {
        communication.connection = connection;

        if (communication.call != null) {
            initCommunication(communication);
        }
    });

    function initCommunication(communication) {
        peerLog("Got Communication");

        const call = communication.call;
        const connection = communication.connection;

        let gotStream = false;

        call.on("stream", (stream) => {
            if (gotStream) return;

            peerLog("Got Stream");
            gotStream = true;

            peerVideoElement.srcObject = stream;
            peerVideoElement.style.display = "block";

            myVideoElement.srcObject = window.myStream;
            myVideoElement.style.display = "block";

            otherPeerIdElement.value = call.peer;
            otherPeerIdElement.disabled = true;
            peerSubmitElement.disabled = true;

            peerDisconnectElement.disabled = false;
            peerDisconnectElement.addEventListener("click", function(event) {
                call.close();
                connection.close();

                onClose();
            }, {
                once: true
            });

            peerChatMessageElement.disabled = false;
            peerChatSubmitElement.disabled = false;

            function setMuted(bool) {
                myStream.getAudioTracks().forEach((track) => {
                    track.enabled = !bool;
                });
            }

            function handleMute(event) {
                setMuted(event.target.checked);
            }

            const muteElementListern = muteElement.addEventListener("change", handleMute);
            setMuted(muteElement.checked);

            connection.on("close", onClose);

            function onClose() {
                peerLog("Call Closed");

                peerVideoElement.srcObject = null;
                peerVideoElement.style.display = "none";

                myVideoElement.srcObject = null;
                myVideoElement.style.display = "none";

                otherPeerIdElement.value = "";
                otherPeerIdElement.disabled = false;
                peerSubmitElement.disabled = false;

                peerDisconnectElement.disabled = true;

                peerChatMessagesElement.innerHTML = "";

                peerChatMessageElement.disabled = true;
                peerChatSubmitElement.disabled = true;

                peerChatFormElement.removeEventListener("submit", handleMessageForm);
                muteElement.removeEventListener("change", handleMute);

                window.myStream.getTracks().forEach((track) => {
                    track.stop();
                });
                delete window.myStream;
            }

            function addMessage(str, userSent) {
                const messageElement = document.createElement("li");

                messageElement.innerHTML = str;
                messageElement.style.color = userSent ? "red" : "inherit";

                peerChatMessagesElement.appendChild(messageElement);
            }

            connection.on("data", (data) => {
                addMessage(data, false);
            });

            function handleMessageForm(event) {
                event.preventDefault();
                event.stopImmediatePropagation();

                const formData = new FormData(event.target);
                const message = formData.get("peerChatMessage");
                connection.send(message);
                addMessage(message, true);

                peerChatMessageElement.value = "";
            }

            peerChatFormElement.addEventListener("submit", handleMessageForm)
        });
    }
});

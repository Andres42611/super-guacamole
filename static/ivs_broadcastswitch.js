document.addEventListener("DOMContentLoaded", async function () {
  // Possible configurations
  const channelConfigs = [
    ["Basic: Landscape", window.IVSBroadcastClient.BASIC_LANDSCAPE],
    ["Basic: Portrait", window.IVSBroadcastClient.BASIC_PORTRAIT],
    ["Standard: Landscape", window.IVSBroadcastClient.STANDARD_LANDSCAPE],
    ["Standard: Portrait", window.IVSBroadcastClient.STANDARD_PORTRAIT]
  ];

  // Set initial config for our broadcast
  const config = {
    ingestEndpoint: "https://g.webrtc.live-video.net:4443",
    streamConfig: window.IVSBroadcastClient.BASIC_LANDSCAPE,
    logLevel: window.IVSBroadcastClient.LOG_LEVEL.DEBUG
  };

  // Get HTML elements
  const startButton = document.getElementById("start");
  const stopButton = document.getElementById("stop");
  const errorEl = document.getElementById("error");
  const previewEl = document.getElementById("preview");
  const videoSelectEl = document.getElementById("video-devices");
  const audioSelectEl = document.getElementById("audio-devices");

  function setError(message) {
    if (Array.isArray(message)) {
      message = message.join("<br/>");
    }
    errorEl.innerHTML = message;
  }

  function clearError() {
    errorEl.innerHTML = "";
  }

  async function getDevices() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      setError("Permissions required for video/audio access.");
      return { videoDevices: [], audioDevices: [] };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      videoDevices: devices.filter((d) => d.kind === "videoinput"),
      audioDevices: devices.filter((d) => d.kind === "audioinput")
    };
  }

  async function initializeDeviceSelect() {
    try {
      videoSelectEl.disabled = false;
      audioSelectEl.disabled = false;

      const { videoDevices, audioDevices } = await getDevices();

      videoDevices.forEach((device, index) => {
        videoSelectEl.options[index] = new Option(device.label, device.deviceId);
      });

      audioSelectEl.options[0] = new Option("None", "None");
      audioDevices.forEach((device, index) => {
        audioSelectEl.options[index + 1] = new Option(device.label, device.deviceId);
      });

      // Select the first available camera by default
      if (videoDevices.length > 0) {
        videoSelectEl.value = videoDevices[0].deviceId;
        await handleVideoDeviceSelect();
      }

      startButton.disabled = false; // Enable start button
    } catch (err) {
      setError(`Device initialization error: ${err.message}`);
    }
  }

  async function handleVideoDeviceSelect() {
    const id = "camera";
    const { videoDevices } = await getDevices();
    
    if (window.client.getVideoInputDevice(id)) {
      window.client.removeVideoInputDevice(id);
    }

    const selectedDevice = videoDevices.find((device) => device.deviceId === videoSelectEl.value);
    const deviceId = selectedDevice ? selectedDevice.deviceId : null;
    const { width, height } = config.streamConfig.maxResolution;
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { max: width }, height: { max: height } },
      audio: false
    });

    await window.client.addVideoInputDevice(cameraStream, id, { index: 0 });

    // Attach the preview video element
    if (!previewEl.srcObject) {
      previewEl.srcObject = cameraStream;
      previewEl.play();
    }
  }

  async function handleAudioDeviceSelect() {
    const id = "microphone";
    const { audioDevices } = await getDevices();

    if (window.client.getAudioInputDevice(id)) {
      window.client.removeAudioInputDevice(id);
    }

    if (audioSelectEl.value.toLowerCase() === "none") return;

    const selectedDevice = audioDevices.find((device) => device.deviceId === audioSelectEl.value);
    if (selectedDevice) {
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedDevice.deviceId }
      });

      await window.client.addAudioInputDevice(microphoneStream, id);
    }
  }

  async function createClient() {
    if (window.client) {
      return; // Prevent reinitialization
    }

    window.client = window.IVSBroadcastClient.create(config);

    window.client.on(
      window.IVSBroadcastClient.BroadcastClientEvents.ACTIVE_STATE_CHANGE,
      (active) => {
        startButton.disabled = active;
        stopButton.disabled = !active;
      }
    );

    window.client.on(window.IVSBroadcastClient.BroadcastClientEvents.ERROR, (err) => {
      setError(`Broadcast Error: ${err.message}`);
    });

    await initializeDeviceSelect();
  }

  async function startBroadcast() {
    const streamKeyEl = document.getElementById("stream-key");
    const endpointEl = document.getElementById("ingest-endpoint");

    if (!streamKeyEl.value || !endpointEl.value) {
      setError("Stream Key and Ingest Endpoint are required.");
      return;
    }

    if (!window.client) {
      setError("Broadcast client is not initialized.");
      return;
    }

    try {
      startButton.disabled = true;
      await window.client.startBroadcast(streamKeyEl.value, endpointEl.value);
    } catch (err) {
      startButton.disabled = false;
      setError(err.toString());
    }
  }

  async function stopBroadcast() {
    try {
      await window.client.stopBroadcast();
    } catch (err) {
      setError(err.toString());
    } finally {
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }

  async function init() {
    await createClient();

    // Attach event listeners programmatically
    startButton.addEventListener("click", startBroadcast);
    stopButton.addEventListener("click", stopBroadcast);
    videoSelectEl.addEventListener("change", handleVideoDeviceSelect);
    audioSelectEl.addEventListener("change", handleAudioDeviceSelect);
  }

  init();
});

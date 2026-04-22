(function () {
  "use strict";

  const FRAME_WIDTH = 1018;
  const FRAME_HEIGHT = 1290;
  const CLIP_X = 109;
  const CLIP_Y = 55;
  const CLIP_W = 800;
  const CLIP_H = 590;
  const CLIP_R = 20;

  let currentScreen = "start";
  let userPhoto = null;
  let photoOffsetX = 0;
  let photoOffsetY = 0;
  let photoScale = 1.0;
  let cameraStream = null;
  let facingMode = "user";
  let frameImage = null;
  let frameLoaded = false;
  let isDirty = true;

  const $ = (sel) => document.querySelector(sel);
  const startScreen = $("#start-screen");
  const adjustScreen = $("#adjust-screen");
  const resultScreen = $("#result-screen");
  const cameraContainer = $("#camera-container");
  const inputButtons = $("#input-buttons");
  const video = $("#camera-preview");
  const previewCanvas = $("#preview-canvas");
  const resultCanvas = $("#result-canvas");
  const loading = $("#loading");
  const fileInput = $("#file-input");
  const btnCamera = $("#btn-camera");
  const btnGallery = $("#btn-gallery");
  const btnFlip = $("#btn-flip");
  const btnShutter = $("#btn-shutter");
  const btnCancelCamera = $("#btn-cancel-camera");
  const btnRetake = $("#btn-retake");
  const btnDone = $("#btn-done");
  const btnDownload = $("#btn-download");
  const btnShare = $("#btn-share");
  const btnAnother = $("#btn-another");

  const previewCtx = previewCanvas.getContext("2d");
  const resultCtx = resultCanvas.getContext("2d");

  function preloadFrame() {
    frameImage = new Image();
    frameImage.onload = function () {
      frameLoaded = true;
    };
    frameImage.src = "rubykaigi_2026_photo_frame.png";
  }

  function showScreen(name) {
    currentScreen = name;
    startScreen.classList.toggle("hidden", name !== "start");
    adjustScreen.classList.toggle("hidden", name !== "adjust");
    resultScreen.classList.toggle("hidden", name !== "result");
  }

  function showLoading(visible) {
    loading.classList.toggle("hidden", !visible);
  }

  function waitForFrame() {
    return new Promise(function (resolve) {
      if (frameLoaded) return resolve();
      showLoading(true);
      frameImage.addEventListener(
        "load",
        function () {
          showLoading(false);
          resolve();
        },
        { once: true }
      );
    });
  }

  // Camera
  async function startCamera() {
    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = cameraStream;
      video.classList.toggle("mirror", facingMode === "user");
      cameraContainer.classList.remove("hidden");
      inputButtons.classList.add("hidden");
    } catch (_err) {
      alert(
        "Could not access camera. Please use the gallery option instead."
      );
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) {
        t.stop();
      });
      cameraStream = null;
    }
    video.srcObject = null;
    cameraContainer.classList.add("hidden");
    inputButtons.classList.remove("hidden");
  }

  async function flipCamera() {
    facingMode = facingMode === "user" ? "environment" : "user";
    stopCamera();
    await startCamera();
  }

  function capturePhoto() {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext("2d");

    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const img = new Image();
    img.onload = function () {
      stopCamera();
      setUserPhoto(img);
    };
    img.src = tempCanvas.toDataURL("image/jpeg", 0.92);
  }

  // File input
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      setUserPhoto(img);
    };
    img.src = url;
    fileInput.value = "";
  }

  async function setUserPhoto(img) {
    userPhoto = img;
    photoOffsetX = 0;
    photoOffsetY = 0;
    photoScale = 1.0;
    await waitForFrame();
    setupPreviewCanvas();
    isDirty = true;
    renderPreview();
    showScreen("adjust");
  }

  // Canvas
  function setupPreviewCanvas() {
    const cssWidth = Math.min(400, window.innerWidth - 32);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasWidth = Math.round(cssWidth * dpr);
    const canvasHeight = Math.round(
      canvasWidth * (FRAME_HEIGHT / FRAME_WIDTH)
    );
    previewCanvas.width = canvasWidth;
    previewCanvas.height = canvasHeight;
    previewCanvas.style.width = cssWidth + "px";
    previewCanvas.style.height =
      Math.round(cssWidth * (FRAME_HEIGHT / FRAME_WIDTH)) + "px";
  }

  function clipRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function renderPreview() {
    if (!isDirty || !userPhoto || !frameImage) return;
    isDirty = false;

    var cw = previewCanvas.width;
    var ch = previewCanvas.height;
    var s = cw / FRAME_WIDTH;
    var ctx = previewCtx;
    var cx = CLIP_X + CLIP_W / 2;
    var cy = CLIP_Y + CLIP_H / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(frameImage, 0, 0, cw, ch);

    ctx.save();
    clipRect(ctx, CLIP_X * s, CLIP_Y * s, CLIP_W * s, CLIP_H * s, CLIP_R * s);
    ctx.clip();

    var baseScale = Math.max(CLIP_W / userPhoto.width, CLIP_H / userPhoto.height);
    var drawScale = baseScale * photoScale * s;
    var drawWidth = userPhoto.width * drawScale;
    var drawHeight = userPhoto.height * drawScale;
    var drawX = cx * s - drawWidth / 2 + photoOffsetX * s;
    var drawY = cy * s - drawHeight / 2 + photoOffsetY * s;

    ctx.drawImage(userPhoto, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    ctx.save();
    clipRect(ctx, CLIP_X * s, CLIP_Y * s, CLIP_W * s, CLIP_H * s, CLIP_R * s);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.restore();
  }

  function renderFinal() {
    resultCanvas.width = FRAME_WIDTH;
    resultCanvas.height = FRAME_HEIGHT;

    var cssWidth = Math.min(400, window.innerWidth - 32);
    resultCanvas.style.width = cssWidth + "px";
    resultCanvas.style.height =
      Math.round(cssWidth * (FRAME_HEIGHT / FRAME_WIDTH)) + "px";

    var ctx = resultCtx;
    var cx = CLIP_X + CLIP_W / 2;
    var cy = CLIP_Y + CLIP_H / 2;
    ctx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

    ctx.drawImage(frameImage, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);

    ctx.save();
    clipRect(ctx, CLIP_X, CLIP_Y, CLIP_W, CLIP_H, CLIP_R);
    ctx.clip();

    var baseScale = Math.max(CLIP_W / userPhoto.width, CLIP_H / userPhoto.height);
    var drawScale = baseScale * photoScale;
    var drawWidth = userPhoto.width * drawScale;
    var drawHeight = userPhoto.height * drawScale;
    var drawX = cx - drawWidth / 2 + photoOffsetX;
    var drawY = cy - drawHeight / 2 + photoOffsetY;

    ctx.drawImage(userPhoto, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    ctx.save();
    clipRect(ctx, CLIP_X, CLIP_Y, CLIP_W, CLIP_H, CLIP_R);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Touch handling
  function setupTouchHandlers() {
    var startTouches = null;
    var startOffset = { x: 0, y: 0 };
    var startScale = 1;
    var startDistance = 0;

    function canvasScale() {
      return FRAME_WIDTH / previewCanvas.getBoundingClientRect().width;
    }

    previewCanvas.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        var touches = e.touches;
        startOffset = { x: photoOffsetX, y: photoOffsetY };
        startScale = photoScale;

        if (touches.length === 1) {
          startTouches = [
            { x: touches[0].clientX, y: touches[0].clientY },
          ];
        } else if (touches.length === 2) {
          startTouches = [
            { x: touches[0].clientX, y: touches[0].clientY },
            { x: touches[1].clientX, y: touches[1].clientY },
          ];
          startDistance = Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
          );
        }
      },
      { passive: false }
    );

    previewCanvas.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
        var touches = e.touches;
        var cs = canvasScale();

        if (
          touches.length === 1 &&
          startTouches &&
          startTouches.length === 1
        ) {
          var dx = (touches[0].clientX - startTouches[0].x) * cs;
          var dy = (touches[0].clientY - startTouches[0].y) * cs;
          photoOffsetX = startOffset.x + dx;
          photoOffsetY = startOffset.y + dy;
          isDirty = true;
          requestAnimationFrame(renderPreview);
        } else if (
          touches.length === 2 &&
          startTouches &&
          startTouches.length === 2
        ) {
          var newDist = Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
          );
          photoScale = Math.max(
            0.5,
            Math.min(4.0, startScale * (newDist / startDistance))
          );

          var midX =
            (touches[0].clientX + touches[1].clientX) / 2;
          var midY =
            (touches[0].clientY + touches[1].clientY) / 2;
          var startMidX =
            (startTouches[0].x + startTouches[1].x) / 2;
          var startMidY =
            (startTouches[0].y + startTouches[1].y) / 2;
          photoOffsetX = startOffset.x + (midX - startMidX) * cs;
          photoOffsetY = startOffset.y + (midY - startMidY) * cs;

          isDirty = true;
          requestAnimationFrame(renderPreview);
        }
      },
      { passive: false }
    );

    previewCanvas.addEventListener("touchend", function (e) {
      if (e.touches.length === 1) {
        startTouches = [
          { x: e.touches[0].clientX, y: e.touches[0].clientY },
        ];
        startOffset = { x: photoOffsetX, y: photoOffsetY };
        startScale = photoScale;
      } else {
        startTouches = null;
      }
    });

    // Mouse fallback
    var mouseDown = false;
    var mouseStartX = 0;
    var mouseStartY = 0;
    var mouseStartOffset = { x: 0, y: 0 };

    previewCanvas.addEventListener("mousedown", function (e) {
      mouseDown = true;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
      mouseStartOffset = { x: photoOffsetX, y: photoOffsetY };
      e.preventDefault();
    });

    window.addEventListener("mousemove", function (e) {
      if (!mouseDown) return;
      var cs = canvasScale();
      photoOffsetX =
        mouseStartOffset.x + (e.clientX - mouseStartX) * cs;
      photoOffsetY =
        mouseStartOffset.y + (e.clientY - mouseStartY) * cs;
      isDirty = true;
      requestAnimationFrame(renderPreview);
    });

    window.addEventListener("mouseup", function () {
      mouseDown = false;
    });

    previewCanvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 0.95 : 1.05;
        photoScale = Math.max(0.5, Math.min(4.0, photoScale * delta));
        isDirty = true;
        requestAnimationFrame(renderPreview);
      },
      { passive: false }
    );
  }

  // Download / Share
  function downloadImage() {
    resultCanvas.toBlob(
      function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "rubykaigi-2026-photo.png";
        a.click();
        URL.revokeObjectURL(url);
      },
      "image/png"
    );
  }

  async function shareImage() {
    try {
      var blob = await new Promise(function (resolve) {
        resultCanvas.toBlob(resolve, "image/png");
      });
      var file = new File([blob], "rubykaigi-2026-photo.png", {
        type: "image/png",
      });
      await navigator.share({ files: [file] });
    } catch (_err) {
      downloadImage();
    }
  }

  // Init
  function init() {
    preloadFrame();

    if (navigator.share && navigator.canShare) {
      btnShare.classList.remove("hidden");
    }

    btnCamera.addEventListener("click", function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(
          "Camera is not available. Please use HTTPS or choose from gallery."
        );
        return;
      }
      startCamera();
    });

    btnGallery.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", handleFileSelect);

    btnFlip.addEventListener("click", flipCamera);
    btnShutter.addEventListener("click", capturePhoto);
    btnCancelCamera.addEventListener("click", stopCamera);

    btnRetake.addEventListener("click", function () {
      userPhoto = null;
      showScreen("start");
    });

    btnDone.addEventListener("click", function () {
      renderFinal();
      showScreen("result");
    });

    btnDownload.addEventListener("click", downloadImage);
    btnShare.addEventListener("click", shareImage);

    btnAnother.addEventListener("click", function () {
      userPhoto = null;
      showScreen("start");
    });

    setupTouchHandlers();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

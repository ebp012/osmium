// Convenience stuff
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => document.querySelectorAll(selector);

const stopCam = () => {
  const video = document.getElementById('bgcontainer');
  const stream = video.srcObject;
  const tracks = stream.getTracks();
  tracks.forEach(track => track.stop());
  video.srcObject = null;
};

const startCam = () => {
  const video = document.querySelector('#bgcontainer');
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
      video.srcObject = stream;
    })
      .catch(error => {
      console.error("Something went wrong!", error);
    });
  } else {
    console.log("getUserMedia not supported on your browser!");
  }
};

$(document).ready(() => {
  startCam();
});

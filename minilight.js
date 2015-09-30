"use strict";

// TODO: break up calculation into timeslices or use webworkers
module.exports = function minilight(image, iterations, camera, scene, random) {
    for (var frameNum = 1; frameNum <= iterations; ++frameNum) {
      console.log('iteration:', frameNum);
      camera.getFrame(scene, image, random);
    }
    return image;
};

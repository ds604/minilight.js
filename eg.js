"use strict";

var MODEL_FORMAT_ID = "#MiniLight";

try
{
   var stream = streamer(model, MODEL_FORMAT_ID);

   var iterations = Math.floor(stream(Real)[0]);
   var image = Image(stream);
   var camera = Camera(stream);

   var scene = Scene(stream, camera.eyePosition());

   minilight(image, iterations, camera, scene, randomGenerator());
   var pgm = image.save(iterations);
}
catch( e )
{
   alert( e.name + " -- " + e.message );
}

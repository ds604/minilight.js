"use strict";

var fs        = require('fs');
var streamer  = require('./stream');
var Image     = require('./image');
var Camera    = require('./camera');
var Real      = require('./real');
var Scene     = require('./scene');
var minilight = require('./minilight');
var randomGenerator = require('./random');

var model = fs.readFileSync(__dirname + '/scenes/cornellbox-n.ml.txt', 'utf8');
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

  document.getElementById('model-data').innerHTML = model;

  var theview = document.getElementById('theview');
  theview.setAttribute( 'width',  image.width  );
  theview.setAttribute( 'height', image.height );
  var ctx = theview.getContext('2d');
  var imgdata = ctx.getImageData(0, 0, theview.width, theview.height);
  image.blit(imgdata, iterations);
  ctx.putImageData(imgdata, 0, 0);
}
catch( e )
{
  alert( e.name + " -- " + e.message );
}
